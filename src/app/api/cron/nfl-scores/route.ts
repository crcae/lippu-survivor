import { type NextRequest, NextResponse } from "next/server";
import { fetchNflGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import {
  evaluatePendingPicksForSeason,
  syncNflGamesInDb,
} from "@/lib/services/nfl-sync";

export const runtime = "nodejs";

const REGULAR_SEASON_WEEKS = 18;

/**
 * GET /api/cron/nfl-scores
 * Scheduled job (see `vercel.json`): fetches the ESPN scoreboard for ALL 18
 * regular-season weeks, upserts finals into `public.nfl_games` and settles any
 * `pending` picks (win/loss/push + entry elimination). Week 18 is NOT skipped
 * or protected — it is synced exactly like every other week so its slate and
 * results stay current. Idempotent and safe to re-run — only `pending` picks
 * are evaluated, so strikes are never double-counted.
 *
 * Security: requires `Authorization: Bearer <CRON_SECRET>` when the
 * `CRON_SECRET` env var is set. When unset the endpoint answers with a 403 so
 * an accidentally-public route can never mutate data in production.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }
  } else {
    console.warn(
      "[cron/nfl-scores] CRON_SECRET no está configurado: la ruta rechaza llamadas.",
    );
    return NextResponse.json(
      { error: "CRON_SECRET no configurado. La ruta cron está deshabilitada." },
      { status: 403 },
    );
  }

  let synced = 0;
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
    const { games, source } = await fetchNflGames(week, SEASON_YEAR);
    if (source !== "espn") continue;

    try {
      const { synced: weekSynced } = await syncNflGamesInDb(games);
      synced += weekSynced;
    } catch (err) {
      console.error(`[cron/nfl-scores] Sync falló en la semana ${week}:`, err);
    }
  }

  let evaluated = 0;
  let eliminated = 0;
  try {
    const result = await evaluatePendingPicksForSeason(REGULAR_SEASON_WEEKS);
    evaluated = result.evaluated;
    eliminated = result.eliminated;
  } catch (err) {
    console.error("[cron/nfl-scores] No se pudo evaluar la temporada:", err);
    return NextResponse.json(
      { ok: false, error: "La evaluación de picks falló." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    year: SEASON_YEAR,
    weeks: REGULAR_SEASON_WEEKS,
    synced,
    evaluated,
    eliminated,
  });
}
