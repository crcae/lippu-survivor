import { type NextRequest, NextResponse } from "next/server";
import { fetchNflGames } from "@/lib/espn";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import { syncNflGamesInDb } from "@/lib/services/nfl-sync";

export const runtime = "nodejs";

const REGULAR_SEASON_WEEKS = 18;

/**
 * GET/POST /api/admin/seed-nfl
 *
 * On-demand full re-seed of the regular season: fetches Weeks 1–18 from the
 * ESPN scoreboard (with `dates` + `seasontype=2`) and upserts every game into
 * `public.nfl_games` using the Supabase Service Role admin client (bypasses
 * RLS). Week 18 is included like any other week — it is never skipped or
 * protected.
 *
 * Security: in non-production the endpoint is callable directly for
 * development/testing. In production it requires
 * `Authorization: Bearer <CRON_SECRET>`; when that secret is unset in
 * production the endpoint refuses to run.
 *
 * Response: `{ success: true, weeksProcessed: N, totalGamesUpserted: X }`.
 */
async function seedAllWeeks(request: NextRequest) {
  const adminKey = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  if (adminKey) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }
  } else if (!isDev) {
    console.warn(
      "[admin/seed-nfl] CRON_SECRET no configurado y fuera de desarrollo: seeding deshabilitado.",
    );
    return NextResponse.json(
      { error: "CRON_SECRET no configurado. El seeding está deshabilitado." },
      { status: 403 },
    );
  }

  let weeksProcessed = 0;
  let totalGamesUpserted = 0;

  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week += 1) {
    const { games, source } = await fetchNflGames(week, SEASON_YEAR);
    if (source !== "espn") {
      console.warn(
        `[admin/seed-nfl] Semana ${week}: ESPN no devolvió datos, se omitió.`,
      );
      continue;
    }

    try {
      const { synced } = await syncNflGamesInDb(games);
      totalGamesUpserted += synced;
      weeksProcessed += 1;
    } catch (err) {
      console.error(
        `[admin/seed-nfl] Upsert falló en la semana ${week}:`,
        err,
      );
    }
  }

  return NextResponse.json({
    success: true,
    weeksProcessed,
    totalGamesUpserted,
  });
}

export async function GET(request: NextRequest) {
  return seedAllWeeks(request);
}

export async function POST(request: NextRequest) {
  return seedAllWeeks(request);
}
