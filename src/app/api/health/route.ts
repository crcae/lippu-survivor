import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const ESPN_TIMEOUT_MS = 5_000;

/**
 * GET /api/health
 *
 * Lightweight liveness + dependency probe used by uptime monitors and the
 * production dashboard. Returns the status of the Supabase database and the
 * ESPN feed without exposing any secrets.
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  let database: "connected" | "disconnected" = "disconnected";
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" });
    database = error ? "disconnected" : "connected";
  } catch {
    database = "disconnected";
  }

  let espn: "online" | "offline" = "offline";
  try {
    const response = await fetch(ESPN_SCOREBOARD_URL, {
      signal: AbortSignal.timeout(ESPN_TIMEOUT_MS),
      cache: "no-store",
    });
    espn = response.ok ? "online" : "offline";
  } catch {
    espn = "offline";
  }

  const status = database === "connected" && espn === "online" ? "ok" : "degraded";

  return NextResponse.json(
    { status, timestamp, espn, database },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
