/* ============================================
   Lippu Survivor — Server-only NFL sync & results
   ============================================

   These helpers run with the Supabase service role key (see
   `@/lib/supabase/admin`) so they can write to `public.nfl_games`, `public.picks`
   and `public.entries` regardless of RLS. They are ONLY meant for trusted
   backend work (API route handlers, cron). Do NOT import this module from
   client components.

   Responsibilities:
   - `syncNflGamesInDb`: persist ESPN games into `public.nfl_games` (upsert on
     the ESPN event id), keeping scores/status live.
   - `evaluatePicksForWeek`: settle `pending` picks for a league+week whose
     games are final → `win` / `loss` / `push`, and eliminate entries whose
     strikes exceed the league limit.
   - `evaluatePendingPicksForSeason`: sweep every league up to a given week.
   ============================================ */

import { getAdminClient } from "@/lib/supabase/admin";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import type { NFLGame, PickResult } from "@/types";

// ── Row shapes (snake_case, only what we touch) ─────────────────────────────

interface GameRow {
  id: string;
  week: number;
  season_year: number;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  start_time: string;
}

interface EntryRow {
  id: string;
  status: "alive" | "eliminated" | "winner";
  strikes: number;
  eliminated_week: number | null;
}

export interface NflSyncResult {
  synced: number;
}

export interface EvaluationResult {
  evaluated: number;
  eliminated: number;
}

/**
 * Upserts real ESPN games into `public.nfl_games`. New games are inserted,
 * existing ones (same ESPN event id) have their status/scores refreshed.
 * `home_score` / `away_score` are stored as `null` while a game is scheduled.
 */
export async function syncNflGamesInDb(
  games: NFLGame[],
): Promise<NflSyncResult> {
  if (games.length === 0) return { synced: 0 };

  const supabase = getAdminClient();

  const rows = games.map(
    (game): GameRow => {
      let startTime = game.startTime;
      if (!startTime || Number.isNaN(new Date(startTime).getTime())) {
        const janMonth = 0;
        const year = (game.seasonYear || SEASON_YEAR) + 1;
        startTime = new Date(Date.UTC(year, janMonth, 10, 18, 0, 0)).toISOString();
      }
      return {
        id: game.id,
        week: game.week,
        season_year: game.seasonYear,
        home_team_id: game.homeTeamId,
        away_team_id: game.awayTeamId,
        home_score: game.homeScore ?? null,
        away_score: game.awayScore ?? null,
        status: game.status,
        start_time: startTime,
      };
    },
  );

  const { data, error } = await supabase
    .from("nfl_games")
    .upsert(rows, { onConflict: "id" })
    .select("id");

  if (error) throw error;

  return { synced: data?.length ?? 0 };
}

/**
 * Evaluates every `pending` pick of a league+week whose game is now final:
 *
 * - `win`  → picked team outscored its opponent (no change).
 * - `loss` → picked team was outscored → entry takes a strike; if strikes now
 *            exceed the league's `strikes_allowed`, the entry is eliminated.
 * - `push` → tied (NFL OT tie) → no change.
 *
 * Idempotent: only `pending` picks are processed, so re-running (e.g. after a
 * later score correction) never double-counts strikes. Entries already
 * eliminated are skipped.
 */
export async function evaluatePicksForWeek(
  leagueId: string,
  week: number,
): Promise<EvaluationResult> {
  const supabase = getAdminClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, strikes_allowed")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) return { evaluated: 0, eliminated: 0 };
  const strikesAllowed = league.strikes_allowed;

  const { data: entries, error: entriesError } = await supabase
    .from("entries")
    .select("id, status, strikes, eliminated_week")
    .eq("league_id", leagueId);
  if (entriesError) throw entriesError;
  if (!entries || entries.length === 0) return { evaluated: 0, eliminated: 0 };

  const entryIds = entries.map((entry) => entry.id);

  const { data: picks, error: picksError } = await supabase
    .from("picks")
    .select("id, entry_id, team_id, result")
    .eq("week", week)
    .in("entry_id", entryIds);
  if (picksError) throw picksError;
  if (!picks || picks.length === 0) return { evaluated: 0, eliminated: 0 };

  const pending = picks.filter((pick) => pick.result === "pending");
  if (pending.length === 0) return { evaluated: 0, eliminated: 0 };

  // Only final games with both scores count for evaluation. `start_time >=
  // season start` excludes any legacy/corrupt rows (e.g. historical 2025).
  const { data: games, error: gamesError } = await supabase
    .from("nfl_games")
    .select("id, home_team_id, away_team_id, home_score, away_score, status")
    .eq("week", week)
    .eq("season_year", SEASON_YEAR)
    .gte("start_time", `${SEASON_YEAR}-01-01`);
  if (gamesError) throw gamesError;

  type FinalGameRow = Pick<
    GameRow,
    "home_team_id" | "away_team_id" | "home_score" | "away_score" | "status"
  >;

  const gameByTeam = new Map<string, FinalGameRow>();
  for (const game of (games ?? []) as FinalGameRow[]) {
    if (game.status !== "final") continue;
    if (game.home_score === null || game.away_score === null) continue;
    gameByTeam.set(game.home_team_id, game);
    gameByTeam.set(game.away_team_id, game);
  }

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));

  const pickUpdates: { id: string; result: PickResult }[] = [];
  const entryUpdates = new Map<
    string,
    { strikes: number; status: EntryRow["status"]; eliminated_week: number | null }
  >();

  let evaluated = 0;
  let eliminated = 0;

  for (const pick of pending) {
    const game = gameByTeam.get(pick.team_id);
    if (!game) continue; // game not final yet — leave pending.
    const entry = entryById.get(pick.entry_id);
    if (!entry || entry.status !== "alive") continue;

    const teamScore =
      game.home_team_id === pick.team_id
        ? game.home_score
        : game.away_score;
    const opponentScore =
      game.home_team_id === pick.team_id
        ? game.away_score
        : game.home_score;

    let result: PickResult;
    if (teamScore! > opponentScore!) result = "win";
    else if (teamScore! < opponentScore!) result = "loss";
    else result = "push";

    pickUpdates.push({ id: pick.id, result });
    evaluated += 1;

    if (result === "loss") {
      const newStrikes = entry.strikes + 1;
      const nowEliminated = newStrikes > strikesAllowed;

      const current = entryUpdates.get(entry.id) ?? {
        strikes: entry.strikes,
        status: entry.status,
        eliminated_week: entry.eliminated_week,
      };
      entryUpdates.set(entry.id, {
        strikes: Math.max(current.strikes, newStrikes),
        status: nowEliminated ? "eliminated" : current.status,
        eliminated_week: nowEliminated ? week : current.eliminated_week,
      });

      if (nowEliminated) eliminated += 1;
    }
  }

  for (const update of pickUpdates) {
    await supabase.from("picks").update({ result: update.result }).eq("id", update.id);
  }
  for (const [entryId, update] of entryUpdates) {
    await supabase
      .from("entries")
      .update({
        strikes: update.strikes,
        status: update.status,
        eliminated_week: update.eliminated_week,
      })
      .eq("id", entryId);
  }

  return { evaluated, eliminated };
}

/**
 * Sweep every league that still has `pending` picks in weeks ≤ `maxWeek`,
 * evaluating them week by week. Idempotent and safe to call on every scoreboard
 * poll — once picks are settled they stop being "pending".
 */
export async function evaluatePendingPicksForSeason(
  maxWeek: number,
): Promise<EvaluationResult> {
  const supabase = getAdminClient();

  const { data: pending, error: pendingError } = await supabase
    .from("picks")
    .select("entry_id, week")
    .eq("result", "pending")
    .lte("week", maxWeek);
  if (pendingError) throw pendingError;
  if (!pending || pending.length === 0) return { evaluated: 0, eliminated: 0 };

  const entryIds = [...new Set(pending.map((pick) => pick.entry_id))];

  const { data: entries, error: entriesError } = await supabase
    .from("entries")
    .select("id, league_id")
    .in("id", entryIds);
  if (entriesError) throw entriesError;

  const leagueIds = [...new Set((entries ?? []).map((entry) => entry.league_id))];

  let evaluated = 0;
  let eliminated = 0;

  for (const leagueId of leagueIds) {
    for (let week = 1; week <= maxWeek; week += 1) {
      const result = await evaluatePicksForWeek(leagueId, week);
      evaluated += result.evaluated;
      eliminated += result.eliminated;
    }
  }

  return { evaluated, eliminated };
}
