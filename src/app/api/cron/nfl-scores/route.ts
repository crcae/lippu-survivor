import { type NextRequest, NextResponse } from "next/server";
import { fetchNflGames } from "@/lib/espn";
import { ACTIVE_WEEK, SEASON_YEAR } from "@/lib/mock-survivor-data";
import {
  evaluatePendingPicksForSeason,
  syncNflGamesInDb,
} from "@/lib/services/nfl-sync";
import { countGamesForWeekInDb } from "@/lib/services/survivor-db";

export const runtime = "nodejs";

/**
 * GET /api/cron/nfl-scores?week=6
 * Scheduled job: fetches the ESPN scoreboard for every week up to the active
 * week, upserts finals into `public.nfl_games` and settles any `pending` picks
 * (win/loss/push + entry elimination). Idempotent and safe to re-run — only
 * `pending` picks are evaluated, so strikes are never double-counted.
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

  const { searchParams } = request.nextUrl;
  const weekParam = searchParams.get("week");
  const maxWeek = weekParam
    ? Number.parseInt(weekParam, 10)
    : ACTIVE_WEEK;

  if (!Number.isInteger(maxWeek) || maxWeek < 1 || maxWeek > 18) {
    return NextResponse.json(
      { error: "Parámetro 'week' inválido. Debe ser un entero entre 1 y 18." },
      { status: 400 },
    );
  }

  let synced = 0;
  for (let week = 1; week <= maxWeek; week += 1) {
    const { games, source } = await fetchNflGames(week, SEASON_YEAR);
    if (source !== "espn") continue;

    // Week 18 is protected: once `nfl_games` has its curated slate it is never
    // overwritten by the ESPN sync.
    try {
      const existingWeek18 = week === 18 ? await countGamesForWeekInDb(week) : 0;
      if (existingWeek18 > 0) continue;
    } catch (err) {
      console.error("[cron/nfl-scores] No se pudo contar la semana 18:", err);
      continue;
    }

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
    const result = await evaluatePendingPicksForSeason(maxWeek);
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
    maxWeek,
    synced,
    evaluated,
    eliminated,
  });
}
