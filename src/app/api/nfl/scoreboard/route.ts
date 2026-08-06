import { type NextRequest, NextResponse } from "next/server";
import { fetchNflGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import {
  evaluatePendingPicksForSeason,
  syncNflGamesInDb,
} from "@/lib/services/nfl-sync";
import { countGamesForWeekInDb } from "@/lib/services/survivor-db";

export const runtime = "nodejs";

/**
 * GET /api/nfl/scoreboard?week=X&year=2026
 * Returns parsed NFL games for a week, served from ESPN with a fallback to
 * mock data. HTTP caching keeps upstream rate limits low.
 *
 * When the games come from ESPN they are also persisted into `public.nfl_games`
 * (upsert on the ESPN event id) so pick lockouts and the automated evaluator
 * always read real data. The persisted games then feed
 * `evaluatePendingPicksForSeason`, which settles `pending` picks whose games
 * are final (win/loss/push) and eliminates entries that ran out of strikes.
 *
 * The season is locked to 2026 (SEASON_YEAR): any other `year` is rejected so
 * the app always reflects the current Lippu Survivor season.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");

  const week = weekParam ? Number.parseInt(weekParam, 10) : Number.NaN;
  const year = yearParam ? Number.parseInt(yearParam, 10) : SEASON_YEAR;

  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return NextResponse.json(
      { error: "Parámetro 'week' inválido. Debe ser un entero entre 1 y 18." },
      { status: 400 },
    );
  }

  if (year !== SEASON_YEAR) {
    return NextResponse.json(
      { error: `La temporada está fijada al año ${SEASON_YEAR}.` },
      { status: 400 },
    );
  }

  const { games, source } = await fetchNflGames(week, year);

  // Persist real ESPN games and evaluate any picks that can now be settled.
  // Both steps are best-effort and never break the scoreboard response.
  //
  // Week 18 is protected: when `nfl_games` already has rows for it, the ESPN
  // sync is skipped so the curated Week 18 slate can never be overwritten.
  if (source === "espn") {
    try {
      const existingWeek18 = week === 18 ? await countGamesForWeekInDb(week) : 0;
      if (existingWeek18 > 0) {
        console.log(
          `[nfl-sync] Semana ${week} protegida: se omitió la sobreescritura de ${existingWeek18} partidos`,
        );
      } else {
        const { synced } = await syncNflGamesInDb(games);
        console.log(`[nfl-sync] Semana ${week}: ${synced} partidos sincronizados`);
      }
    } catch (err) {
      console.error("[nfl-sync] No se pudieron sincronizar los partidos:", err);
    }

    try {
      const { evaluated, eliminated } = await evaluatePendingPicksForSeason(week);
      if (evaluated > 0) {
        console.log(
          `[nfl-sync] Evaluados ${evaluated} picks · ${eliminated} eliminaciones`,
        );
      }
    } catch (err) {
      console.error("[nfl-sync] No se pudo evaluar la semana:", err);
    }
  }

  return NextResponse.json(
    { week, year, games, source },
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=59",
        "X-Survivor-Source": source,
      },
    },
  );
}
