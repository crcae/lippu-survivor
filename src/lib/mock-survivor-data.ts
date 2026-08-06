/* ============================================
   Lippu Survivor — Mock Data
   High-quality mock NFL teams, weekly schedule
   and leaderboard participants for the dashboard.
   ============================================ */

import type {
  LeaderboardParticipant,
  WeekMatchup,
} from "@/types";
import type { NFLConference, NFLDivision, NFLTeam, NFLTeamId } from "@/types";

// ── Constants ──

export const SEASON_YEAR = 2026;
export const WEEK_NUMBERS = Array.from({ length: 18 }, (_, i) => i + 1);
export const ACTIVE_WEEK = 6;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// Kickoff slot offsets (hours) relative to the week's anchor (Sunday noon).
// Slot 0 simulates the Thursday night game, slot 13 the Sunday night game and
// slot 14 the Monday night game — so during the ACTIVE_WEEK the first games are
// already "locked" (kickoff passed) while the rest are still upcoming.
const SLOT_OFFSET_HOURS = [
  -64, // Thu 8:15pm
  1,   // Sun 1:00pm
  4.08, // Sun 4:05pm
  4.42, // Sun 4:25pm
  5,   // Sun 5:00pm
  6,   // Sun 6:00pm
  7,   // Sun 7:00pm
  8.33, // Sun 8:20pm
  1.5, // Sun 1:30pm
  2.5, // Sun 2:30pm
  3.5, // Sun 3:30pm
  4.67, // Sun 4:40pm
  5.5, // Sun 5:30pm
  8.33, // Sun 8:20pm
  32.25, // Mon 8:15pm
  6.5, // Sun 6:30pm
];

// ── NFL Teams ──

interface TeamSeed {
  id: NFLTeamId;
  name: string;
  city: string;
  conference: NFLConference;
  division: NFLDivision;
  primaryColor: string;
  secondaryColor: string;
}

const TEAM_SEEDS: TeamSeed[] = [
  // AFC East
  { id: "BUF", name: "Bills", city: "Buffalo", conference: "AFC", division: "East", primaryColor: "#00338D", secondaryColor: "#C60C30" },
  { id: "MIA", name: "Dolphins", city: "Miami", conference: "AFC", division: "East", primaryColor: "#008E97", secondaryColor: "#FC4C02" },
  { id: "NE", name: "Patriots", city: "New England", conference: "AFC", division: "East", primaryColor: "#002244", secondaryColor: "#C60C30" },
  { id: "NYJ", name: "Jets", city: "New York", conference: "AFC", division: "East", primaryColor: "#125740", secondaryColor: "#6C7B85" },
  // AFC North
  { id: "BAL", name: "Ravens", city: "Baltimore", conference: "AFC", division: "North", primaryColor: "#241773", secondaryColor: "#9E7C0C" },
  { id: "CIN", name: "Bengals", city: "Cincinnati", conference: "AFC", division: "North", primaryColor: "#FB4F14", secondaryColor: "#000000" },
  { id: "CLE", name: "Browns", city: "Cleveland", conference: "AFC", division: "North", primaryColor: "#311D00", secondaryColor: "#FF3C00" },
  { id: "PIT", name: "Steelers", city: "Pittsburgh", conference: "AFC", division: "North", primaryColor: "#FFB612", secondaryColor: "#101820" },
  // AFC South
  { id: "HOU", name: "Texans", city: "Houston", conference: "AFC", division: "South", primaryColor: "#03202F", secondaryColor: "#A71930" },
  { id: "IND", name: "Colts", city: "Indianapolis", conference: "AFC", division: "South", primaryColor: "#002C5F", secondaryColor: "#A2AAAD" },
  { id: "JAX", name: "Jaguars", city: "Jacksonville", conference: "AFC", division: "South", primaryColor: "#006778", secondaryColor: "#D7A22A" },
  { id: "TEN", name: "Titans", city: "Tennessee", conference: "AFC", division: "South", primaryColor: "#0C2340", secondaryColor: "#4B92DB" },
  // AFC West
  { id: "DEN", name: "Broncos", city: "Denver", conference: "AFC", division: "West", primaryColor: "#FB4F14", secondaryColor: "#002244" },
  { id: "KC", name: "Chiefs", city: "Kansas City", conference: "AFC", division: "West", primaryColor: "#E31837", secondaryColor: "#FFB612" },
  { id: "LV", name: "Raiders", city: "Las Vegas", conference: "AFC", division: "West", primaryColor: "#000000", secondaryColor: "#A5ACAF" },
  { id: "LAC", name: "Chargers", city: "Los Angeles", conference: "AFC", division: "West", primaryColor: "#0080C6", secondaryColor: "#FFC20E" },
  // NFC East
  { id: "DAL", name: "Cowboys", city: "Dallas", conference: "NFC", division: "East", primaryColor: "#041E42", secondaryColor: "#869397" },
  { id: "NYG", name: "Giants", city: "New York", conference: "NFC", division: "East", primaryColor: "#0B2265", secondaryColor: "#A71930" },
  { id: "PHI", name: "Eagles", city: "Philadelphia", conference: "NFC", division: "East", primaryColor: "#004C54", secondaryColor: "#A5ACAF" },
  { id: "WAS", name: "Commanders", city: "Washington", conference: "NFC", division: "East", primaryColor: "#5A1414", secondaryColor: "#FFB612" },
  // NFC North
  { id: "CHI", name: "Bears", city: "Chicago", conference: "NFC", division: "North", primaryColor: "#0B162A", secondaryColor: "#C83803" },
  { id: "DET", name: "Lions", city: "Detroit", conference: "NFC", division: "North", primaryColor: "#0076B6", secondaryColor: "#B0B7BC" },
  { id: "GB", name: "Packers", city: "Green Bay", conference: "NFC", division: "North", primaryColor: "#203731", secondaryColor: "#FFB612" },
  { id: "MIN", name: "Vikings", city: "Minnesota", conference: "NFC", division: "North", primaryColor: "#4F2683", secondaryColor: "#FFC62F" },
  // NFC South
  { id: "ATL", name: "Falcons", city: "Atlanta", conference: "NFC", division: "South", primaryColor: "#A71930", secondaryColor: "#000000" },
  { id: "CAR", name: "Panthers", city: "Carolina", conference: "NFC", division: "South", primaryColor: "#0085CA", secondaryColor: "#101820" },
  { id: "NO", name: "Saints", city: "New Orleans", conference: "NFC", division: "South", primaryColor: "#D3BC8D", secondaryColor: "#101820" },
  { id: "TB", name: "Buccaneers", city: "Tampa Bay", conference: "NFC", division: "South", primaryColor: "#D50A0A", secondaryColor: "#FF7900" },
  // NFC West
  { id: "ARI", name: "Cardinals", city: "Arizona", conference: "NFC", division: "West", primaryColor: "#97233F", secondaryColor: "#000000" },
  { id: "LAR", name: "Rams", city: "Los Angeles", conference: "NFC", division: "West", primaryColor: "#003594", secondaryColor: "#FFA300" },
  { id: "SF", name: "49ers", city: "San Francisco", conference: "NFC", division: "West", primaryColor: "#AA0000", secondaryColor: "#B3995D" },
  { id: "SEA", name: "Seahawks", city: "Seattle", conference: "NFC", division: "West", primaryColor: "#002244", secondaryColor: "#69BE28" },
];

export const NFL_TEAMS: Record<NFLTeamId, NFLTeam> = Object.fromEntries(
  TEAM_SEEDS.map((seed) => [
    seed.id,
    {
      id: seed.id,
      name: seed.name,
      city: seed.city,
      abbreviation: seed.id,
      conference: seed.conference,
      division: seed.division,
      logoUrl: "",
      primaryColor: seed.primaryColor,
      secondaryColor: seed.secondaryColor,
    } satisfies NFLTeam,
  ]),
) as Record<NFLTeamId, NFLTeam>;

export const NFL_TEAM_LIST: NFLTeam[] = Object.values(NFL_TEAMS);

export function getTeam(id: NFLTeamId): NFLTeam {
  return NFL_TEAMS[id];
}

// ── Weekly Schedule Generator ──

const TEAM_ORDER: NFLTeamId[] = Object.keys(NFL_TEAMS) as NFLTeamId[];

function weekAnchor(now: number, week: number): number {
  return now + (week - ACTIVE_WEEK) * 7 * DAY_MS;
}

function pairMatchups(week: number, a: NFLTeamId, b: NFLTeamId, isHomeA: boolean, slotIndex: number, anchor: number): [WeekMatchup, WeekMatchup] {
  const kickoffTime = new Date(
    anchor + SLOT_OFFSET_HOURS[slotIndex] * HOUR_MS,
  ).toISOString();
  return [
    { week, teamId: a, opponentId: b, isHome: isHomeA, kickoffTime },
    { week, teamId: b, opponentId: a, isHome: !isHomeA, kickoffTime },
  ];
}

/** Build a deterministic 32-team, 18-week mock schedule anchored to `now`. */
export function generateSchedule(now: number): Record<number, WeekMatchup[]> {
  const schedule: Record<number, WeekMatchup[]> = {};

  for (const week of WEEK_NUMBERS) {
    const anchor = weekAnchor(now, week);
    const matchups: WeekMatchup[] = [];

    // Standard circle method: fix the first team, rotate the remaining 31.
    const rotating = [...TEAM_ORDER.slice(1)];
    for (let r = 0; r < (week - 1) % 31; r++) {
      rotating.unshift(rotating.pop()!);
    }
    const line = [TEAM_ORDER[0], ...rotating];

    for (let i = 0; i < 16; i++) {
      const a = line[i];
      const b = line[31 - i];
      const isHomeA = (week + i) % 2 === 0;
      matchups.push(...pairMatchups(week, a, b, isHomeA, i, anchor));
    }

    schedule[week] = matchups;
  }

  return schedule;
}

/** Week matchup lookups for a team across every week. */
export function buildTeamMatchups(
  schedule: Record<number, WeekMatchup[]>,
): Record<NFLTeamId, WeekMatchup[]> {
  const byTeam = Object.fromEntries(
    Object.keys(NFL_TEAMS).map((id) => [id, []]),
  ) as unknown as Record<NFLTeamId, WeekMatchup[]>;

  for (const week of WEEK_NUMBERS) {
    for (const matchup of schedule[week]) {
      byTeam[matchup.teamId].push(matchup);
    }
  }

  return byTeam;
}

// ── Mock Leaderboard Participants ──

const P = (
  id: string,
  name: string,
  entryName: string,
  status: LeaderboardParticipant["status"],
  strikes: number,
  pickHistory: (NFLTeamId | null)[],
): LeaderboardParticipant => ({
  id,
  userId: id,
  name,
  entryName,
  status,
  strikes,
  pickHistory,
});

const fullHistory = (picks: NFLTeamId[], eliminatedWeek?: number): (NFLTeamId | null)[] => {
  const history: (NFLTeamId | null)[] = [];
  for (let week = 1; week <= 18; week++) {
    if (week <= picks.length && (!eliminatedWeek || week <= eliminatedWeek)) {
      history.push(picks[week - 1]);
    } else {
      history.push(null);
    }
  }
  return history;
};

export const MOCK_PARTICIPANTS: LeaderboardParticipant[] = [
  P("u-matias", "Matias", "Matias - Pick #1", "alive", 0, fullHistory(["KC", "BUF", "SF", "PHI", "BAL", "DAL"])),
  P("u-andrea", "Andrea", "Andrea - Pick #1", "alive", 0, fullHistory(["PHI", "KC", "BUF", "SF", "CIN", "MIN"])),
  P("u-luis", "Luis", "Luis - Pick #1", "alive", 1, fullHistory(["BUF", "PHI", "KC", "SF", "BAL", "GB"])),
  P("u-sara", "Sara", "Sara - Pick #1", "alive", 1, fullHistory(["SF", "PHI", "BUF", "KC", "DAL", "SEA"])),
  P("u-carlos", "Carlos", "Carlos - Pick #1", "alive", 0, fullHistory(["BAL", "BUF", "PHI", "KC", "SF", "MIA"])),
  P("u-julia", "Julia", "Julia - Pick #1", "eliminated", 1, fullHistory(["KC", "BUF", "SF", "PHI"], 4)),
  P("u-diego", "Diego", "Diego - Pick #1", "eliminated", 1, fullHistory(["PHI", "KC", "BUF"], 3)),
  P("u-valeria", "Valeria", "Valeria - Pick #1", "eliminated", 1, fullHistory(["SF", "PHI"], 2)),
  P("u-roberto", "Roberto", "Roberto - Pick #1", "alive", 1, fullHistory(["BUF", "PHI", "KC", "SF", "BAL", "LV"])),
  P("u-gabriela", "Gabriela", "Gabriela - Pick #1", "eliminated", 1, fullHistory(["KC"], 1)),
];
