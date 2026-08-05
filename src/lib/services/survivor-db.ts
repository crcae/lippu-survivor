"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  EntryStatus,
  League,
  LeaderboardParticipant,
  NFLTeamId,
  PickResult,
  WeekPicks,
} from "@/types";

// ── Database row shapes (snake_case) ────────────────────────────────────────

interface LeagueRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  season_year: number;
  max_entries_per_user: number;
  capacity: number | null;
  strikes_allowed: number;
  entry_fee: number | string;
  invite_code: string;
  status: League["status"];
  created_at: string;
  updated_at: string;
}

interface EntryRow {
  id: string;
  user_id: string;
  league_id: string;
  entry_name: string;
  status: EntryStatus;
  strikes: number;
  eliminated_week: number | null;
  created_at: string;
  updated_at: string;
}

interface PickRow {
  id: string;
  entry_id: string;
  week: number;
  team_id: string;
  result: PickResult;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LeaderboardRow {
  league_id: string;
  user_id: string;
  entry_id: string;
  entry_name: string;
  status: EntryStatus;
  strikes: number;
  wins: number;
}

// ── Public payload / result types ───────────────────────────────────────────

export interface CreateLeaguePayload {
  name: string;
  seasonYear: number;
  maxEntriesPerUser: number;
  capacity?: number | null;
  strikesAllowed: number;
  entryFee: number;
  inviteCode: string;
}

export interface LeagueEntry {
  id: string;
  userId: string;
  leagueId: string;
  entryName: string;
  status: EntryStatus;
  strikes: number;
  eliminatedWeek?: number;
}

export interface LeagueLookup {
  league: League;
  entryCount: number;
}

export interface LeagueDashboardData {
  league: League | null;
  userEntries: LeagueEntry[];
  leaderboard: LeaderboardParticipant[];
  /** Picks grouped by entry id, so multi-entry contexts stay isolated. */
  picksByEntry: Record<string, WeekPicks>;
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
}

// ── Mappers (snake_case → camelCase) ────────────────────────────────────────

function mapLeague(row: LeagueRow): League {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerId: row.owner_id,
    seasonYear: row.season_year,
    status: row.status,
    maxEntries: row.max_entries_per_user,
    inviteCode: row.invite_code,
    capacity: row.capacity ?? undefined,
    strikesAllowed: row.strikes_allowed,
    entryFee: Number(row.entry_fee),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeagueEntry(row: EntryRow): LeagueEntry {
  return {
    id: row.id,
    userId: row.user_id,
    leagueId: row.league_id,
    entryName: row.entry_name,
    status: row.status,
    strikes: row.strikes,
    eliminatedWeek: row.eliminated_week ?? undefined,
  };
}

const NO_ROWS = ["00000000-0000-0000-0000-000000000000"];

// ── Identity helper ─────────────────────────────────────────────────────────

/**
 * Returns the authenticated Supabase user, or `null` when no session exists.
 * Throws when the Supabase environment variables are missing.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const metadata = user.user_metadata as {
    display_name?: string;
  } | null;

  return {
    id: user.id,
    email: user.email ?? "",
    displayName:
      metadata?.display_name ?? user.email?.split("@")[0] ?? "Player",
  };
}

// ── Leagues ─────────────────────────────────────────────────────────────────

/**
 * Creates a league owned by the current user. Guarantees a `profiles` row for
 * the owner and registers their first `entries` row. Returns the new league id.
 */
export async function createLeagueInDb(
  payload: CreateLeaguePayload,
): Promise<{ leagueId: string }> {
  const supabase = createClient();

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Debes iniciar sesión para crear una liga.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      avatar_url: null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) throw profileError;

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: payload.name,
      owner_id: user.id,
      season_year: payload.seasonYear,
      max_entries_per_user: payload.maxEntriesPerUser,
      capacity: payload.capacity ?? null,
      strikes_allowed: payload.strikesAllowed,
      entry_fee: payload.entryFee,
      invite_code: payload.inviteCode,
      status: "active",
    })
    .select("id")
    .single();
  if (leagueError) throw leagueError;

  const { error: entryError } = await supabase.from("entries").insert({
    user_id: user.id,
    league_id: league.id,
    entry_name: "Entrada #1",
  });
  if (entryError) throw entryError;

  return { leagueId: league.id };
}

/**
 * Looks up a league by its invite code, returning the league plus the current
 * entry count (used to validate capacity). Returns `null` when not found.
 */
export async function getLeagueByInviteCode(
  code: string,
): Promise<LeagueLookup | null> {
  const supabase = createClient();

  const { data: leagueRow, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!leagueRow) return null;

  const { count } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueRow.id);

  return { league: mapLeague(leagueRow), entryCount: count ?? 0 };
}

/**
 * Registers a new entry for the user in a league, enforcing per-user entry
 * limits, total capacity and a unique entry name.
 */
export async function joinLeagueInDb(
  leagueId: string,
  userId: string,
  entryName: string,
): Promise<{ entryId: string }> {
  const supabase = createClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) throw new Error("La liga no existe.");

  const { count: userEntries, error: countError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (countError) throw countError;

  if (userEntries !== null && userEntries >= league.max_entries_per_user) {
    throw new Error("Alcanzaste el máximo de entradas permitidas en esta liga.");
  }

  const { count: totalEntries, error: totalError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  if (totalError) throw totalError;

  if (league.capacity !== null && totalEntries !== null && totalEntries >= league.capacity) {
    throw new Error("Esta liga ya está llena.");
  }

  const baseName = entryName.trim() || "Entrada #1";
  const { data: existingNames } = await supabase
    .from("entries")
    .select("entry_name")
    .eq("league_id", leagueId);
  const names = new Set((existingNames ?? []).map((row) => row.entry_name));

  let finalName = baseName;
  let suffix = 2;
  while (names.has(finalName)) {
    finalName = `${baseName} #${suffix}`;
    suffix += 1;
  }

  const { data: entry, error: insertError } = await supabase
    .from("entries")
    .insert({
      user_id: userId,
      league_id: leagueId,
      entry_name: finalName,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  return { entryId: entry.id };
}

// ── Dashboard ───────────────────────────────────────────────────────────────

/**
 * Loads everything the league dashboard needs: league details, the
 * leaderboard (with pick history), the current user's entries and their picks.
 */
export async function getLeagueDashboardData(
  leagueId: string,
): Promise<LeagueDashboardData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data: leagueRow, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!leagueRow) {
    return { league: null, userEntries: [], leaderboard: [], picksByEntry: {} };
  }

  const { data: lbRows, error: lbError } = (await supabase
    .from("league_leaderboard")
    .select("*")
    .eq("league_id", leagueId)) as {
    data: LeaderboardRow[] | null;
    error: Error | null;
  };
  if (lbError) throw lbError;

  const entryIds = (lbRows ?? []).map((row) => row.entry_id);
  const userIds = [...new Set((lbRows ?? []).map((row) => row.user_id))];

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds.length ? userIds : NO_ROWS);

  const { data: pickRows } = (await supabase
    .from("picks")
    .select("*")
    .in("entry_id", entryIds.length ? entryIds : NO_ROWS)) as {
    data: PickRow[] | null;
  };

  const displayNameById = new Map(
    (profileRows ?? []).map((row) => [row.id, row.display_name]),
  );

  const picksByEntry: Record<string, WeekPicks> = {};
  const allPickRows = pickRows ?? [];

  const leaderboard: LeaderboardParticipant[] = (lbRows ?? []).map((row) => {
    const entryPicks = allPickRows.filter((p) => p.entry_id === row.entry_id);
    const pickHistory: (NFLTeamId | null)[] = Array.from(
      { length: 18 },
      (_, i) => {
        const pick = entryPicks.find((p) => p.week === i + 1);
        return pick ? (pick.team_id as NFLTeamId) : null;
      },
    );

    return {
      id: row.entry_id,
      name: displayNameById.get(row.user_id) ?? "Jugador",
      entryName: row.entry_name,
      status: row.status,
      strikes: row.strikes,
      pickHistory,
    };
  });

  let userEntries: LeagueEntry[] = [];

  if (userId) {
    const { data: myEntries } = await supabase
      .from("entries")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    userEntries = (myEntries ?? []).map(mapLeagueEntry);

    for (const entry of userEntries) {
      const entryPicks = allPickRows.filter((p) => p.entry_id === entry.id);
      const map: WeekPicks = {};
      for (const pick of entryPicks) {
        map[pick.week] = pick.team_id as NFLTeamId;
      }
      picksByEntry[entry.id] = map;
    }
  }

  return {
    league: mapLeague(leagueRow),
    userEntries,
    leaderboard,
    picksByEntry,
  };
}

// ── Picks ───────────────────────────────────────────────────────────────────

/**
 * Upserts a pick for an entry+week pair, honoring the unique
 * `(entry_id, week)` constraint.
 */
export async function savePickInDb(
  entryId: string,
  week: number,
  teamId: NFLTeamId,
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("picks").upsert(
    { entry_id: entryId, week, team_id: teamId, result: "pending" },
    { onConflict: "entry_id,week" },
  );
  if (error) throw error;
}
