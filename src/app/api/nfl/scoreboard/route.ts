import { type NextRequest, NextResponse } from "next/server";
import { fetchNflGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

export const runtime = "nodejs";

/**
 * GET /api/nfl/scoreboard?week=X&year=2026
 * Returns parsed NFL games for a week, served from ESPN with a
 * fallback to mock data. HTTP caching keeps upstream rate limits low.
 *
 * The season is locked to 2026 (SEASON_YEAR): any other `year` is rejected
 * so the app always reflects the current Lippu Survivor season.
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
