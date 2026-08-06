/* ============================================
   Lippu Survivor — ESPN NFL API Integration
   Fetches live/scheduled NFL games from ESPN's
   public scoreboard endpoint and maps them to our
   internal `NFLGame` type. Falls back to mock data
   on any fetch error, timeout, or empty response.
   ============================================ */

import type { GameStatus, NFLGame, NFLTeamId } from "@/types";
import {
  ACTIVE_WEEK,
  NFL_TEAMS,
  SEASON_YEAR,
  generateSchedule,
} from "./mock-survivor-data";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const FETCH_TIMEOUT_MS = 8_000;

/** Handle ESPN abbreviations that differ from ours. */
const ABBREVIATION_ALIASES: Record<string, NFLTeamId> = {
  LA: "LAR",
  STL: "LAR",
  WSH: "WAS",
  SD: "LAC",
  OAK: "LV",
  BLT: "BAL",
  CLV: "CLE",
};

const NFL_TEAM_ID_SET = new Set<NFLTeamId>(Object.keys(NFL_TEAMS) as NFLTeamId[]);

// ── ESPN response shapes (partial, only what we need) ──

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    location?: string;
  };
}

interface EspnStatus {
  type?: {
    id?: string;
    name?: string;
    state?: "pre" | "in" | "post";
    detail?: string;
    shortDetail?: string;
    completed?: boolean;
  };
  period?: number;
  clock?: string | number;
}

interface EspnEvent {
  id?: string;
  date?: string;
  status?: EspnStatus;
  competitions?: { competitors?: EspnCompetitor[] }[];
}

interface EspnScoreboard {
  events?: EspnEvent[];
  week?: { number?: number };
}

// ── Public result shape ──

export interface NflGamesResult {
  games: NFLGame[];
  source: "espn" | "mock";
}

function isNflTeamId(value: string): value is NFLTeamId {
  return NFL_TEAM_ID_SET.has(value as NFLTeamId);
}

function mapAbbreviation(abbreviation?: string): NFLTeamId | null {
  if (!abbreviation) return null;
  const normalized = abbreviation.trim().toUpperCase();
  const resolved = ABBREVIATION_ALIASES[normalized] ?? normalized;
  return isNflTeamId(resolved) ? resolved : null;
}

function mapStatus(status?: EspnStatus): GameStatus {
  const typeName = status?.type?.name ?? "";
  if (typeName.includes("POSTPONED") || typeName.includes("CANCELED")) {
    return "postponed";
  }
  if (typeName.includes("FINAL") || status?.type?.state === "post") {
    return "final";
  }
  if (status?.type?.state === "in") {
    return "in_progress";
  }
  return "scheduled";
}

function scoreOf(competitor?: EspnCompetitor): number | undefined {
  const raw = competitor?.score;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Helper returning Sunday 13:00 EST of Week 18 (e.g. Jan 10, 2027 for 2026 season)
 * as the standard fallback kickoff time when ESPN or DB dates are unconfirmed/TBD.
 */
export function getWeek18TbdKickoff(seasonYear = SEASON_YEAR): string {
  const janMonth = 0; // January
  const year = seasonYear + 1;
  const d = new Date(Date.UTC(year, janMonth, 10, 18, 0, 0)); // 13:00 EST = 18:00 UTC
  return d.toISOString();
}

/** Map a raw ESPN event to our `NFLGame` shape (or null if unmappable). */
function mapEvent(event: EspnEvent, week: number, year: number): NFLGame | null {
  const competition = event.competitions?.[0];
  if (!competition) return null;

  const home = competition.competitors?.find((c) => c.homeAway === "home");
  const away = competition.competitors?.find((c) => c.homeAway === "away");

  const homeTeamId = mapAbbreviation(home?.team?.abbreviation);
  const awayTeamId = mapAbbreviation(away?.team?.abbreviation);
  if (!homeTeamId || !awayTeamId) return null;

  const status = mapStatus(event.status);
  const period = event.status?.period;
  const rawClock = event.status?.clock;
  const clock = rawClock !== undefined ? String(rawClock) : undefined;
  const statusDetail = event.status?.type?.shortDetail ?? event.status?.type?.detail;

  const rawDate = event.date;
  const isInvalidDate = !rawDate || Number.isNaN(new Date(rawDate).getTime());
  const isExplicitTbd = statusDetail?.toUpperCase().includes("TBD") || false;

  let startTime = rawDate ?? new Date(0).toISOString();
  let isTbd = isExplicitTbd || isInvalidDate;

  if (week === 18 && (isInvalidDate || isExplicitTbd)) {
    startTime = getWeek18TbdKickoff(year);
    isTbd = true;
  }

  return {
    id: event.id ?? `espn-${year}-w${week}-${homeTeamId}-${awayTeamId}`,
    week,
    seasonYear: year,
    homeTeamId,
    awayTeamId,
    homeScore: scoreOf(home),
    awayScore: scoreOf(away),
    status,
    startTime,
    period,
    clock,
    statusDetail,
    isTbd,
  };
}

/** Parse an ESPN scoreboard payload into `NFLGame[]`. */
export function parseEspnScoreboard(
  payload: EspnScoreboard,
  week: number,
  year: number,
): NFLGame[] {
  if (!Array.isArray(payload?.events)) return [];

  return payload.events
    .map((event) => mapEvent(event, week, year))
    .filter((game): game is NFLGame => game !== null);
}

/** Build mock `NFLGame[]` for a week from our deterministic schedule. */
export function buildMockGames(week: number, year = SEASON_YEAR): NFLGame[] {
  const DAY_MS = 86_400_000;
  const HOUR_MS = 3_600_000;

  const anchor =
    week < ACTIVE_WEEK
      ? Date.now() + (ACTIVE_WEEK - week) * 7 * DAY_MS + 65 * HOUR_MS
      : Date.now();

  const schedule = generateSchedule(anchor);
  const matchups = schedule[week] ?? [];

  return matchups
    .filter((matchup) => matchup.isHome)
    .map((matchup) => {
      const isWeek18 = week === 18;
      const startTime = isWeek18 ? getWeek18TbdKickoff(year) : matchup.kickoffTime;
      return {
        id: `mock-${year}-w${week}-${matchup.teamId}-${matchup.opponentId}`,
        week,
        seasonYear: year,
        homeTeamId: matchup.teamId,
        awayTeamId: matchup.opponentId,
        status: "scheduled" as const,
        startTime,
        isTbd: isWeek18,
      };
    });
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch real NFL games for a week from ESPN, falling back to mock data.
 * Falls back when the fetch fails, times out, or returns no games.
 */
export async function fetchNflGames(
  week: number,
  year = SEASON_YEAR,
): Promise<NflGamesResult> {
  const url = `${ESPN_SCOREBOARD_URL}?week=${week}&year=${year}`;

  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response.ok) {
      throw new Error(`ESPN responded with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as EspnScoreboard;
    const games = parseEspnScoreboard(payload, week, year);

    if (games.length === 0) {
      throw new Error(`ESPN returned no games for week ${week}`);
    }

    return { games, source: "espn" };
  } catch (error) {
    console.warn(
      `[espn] Falling back to mock data for week ${week}:`,
      error instanceof Error ? error.message : error,
    );
    return { games: buildMockGames(week, year), source: "mock" };
  }
}

/**
 * Client-side convenience: fetch games through our API route
 * (which adds HTTP caching and server-side ESPN handling).
 */
export async function getNflGames(
  week: number,
  year = SEASON_YEAR,
): Promise<NflGamesResult> {
  const response = await fetch(
    `/api/nfl/scoreboard?week=${week}&year=${year}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Scoreboard API responded with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as NflGamesResult & {
    games?: NFLGame[];
    source?: "espn" | "mock";
  };

  return { games: payload.games ?? [], source: payload.source ?? "mock" };
}
