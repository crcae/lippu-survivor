/* ============================================
   Lippu Survivor — TypeScript Type Definitions
   ============================================ */

// ── Users ──

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Leagues ──

export type LeagueStatus = "draft" | "active" | "completed" | "archived";

export interface League {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  seasonYear: number;
  status: LeagueStatus;
  maxEntries: number;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
}

// ── Entries ──

export type EntryStatus = "alive" | "eliminated" | "winner";

export interface Entry {
  id: string;
  userId: string;
  leagueId: string;
  status: EntryStatus;
  eliminatedWeek?: number;
  createdAt: string;
}

// ── Picks ──

export type PickResult = "pending" | "win" | "loss" | "push";

export interface Pick {
  id: string;
  entryId: string;
  week: number;
  teamId: NFLTeamId;
  result: PickResult;
  lockedAt?: string;
  createdAt: string;
}

// ── NFL Teams ──

export type NFLConference = "AFC" | "NFC";
export type NFLDivision = "North" | "South" | "East" | "West";

export type NFLTeamId =
  | "ARI" | "ATL" | "BAL" | "BUF"
  | "CAR" | "CHI" | "CIN" | "CLE"
  | "DAL" | "DEN" | "DET" | "GB"
  | "HOU" | "IND" | "JAX" | "KC"
  | "LV"  | "LAC" | "LAR" | "MIA"
  | "MIN" | "NE"  | "NO"  | "NYG"
  | "NYJ" | "PHI" | "PIT" | "SF"
  | "SEA" | "TB"  | "TEN" | "WAS";

export interface NFLTeam {
  id: NFLTeamId;
  name: string;
  city: string;
  abbreviation: string;
  conference: NFLConference;
  division: NFLDivision;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

// ── NFL Games / Matchups ──

export type GameStatus = "scheduled" | "in_progress" | "final" | "postponed";

export interface NFLGame {
  id: string;
  week: number;
  seasonYear: number;
  homeTeamId: NFLTeamId;
  awayTeamId: NFLTeamId;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  startTime: string;
}
