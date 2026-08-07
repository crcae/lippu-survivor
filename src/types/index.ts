/* ============================================
   Lippu Survivor — TypeScript Type Definitions
   ============================================ */

export * from "./survivor";

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
  capacity?: number;
  strikesAllowed?: number;
  entryFee?: number;
  /** "paid" when players pay to join, "free" otherwise. */
  leagueType?: "paid" | "free";
  /** When true the league is listed on the public landing page. */
  isPublic?: boolean;
  /** Platform fee charged per entry (e.g. 10 = 10%). */
  platformFeePercent?: number;
  /** Prize pool stored on the league record (kept in sync with payments). */
  bolsaTotal?: number;
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
  /** Live game clock, e.g. "05:20" (ESPN `status.clock`). */
  clock?: string;
  /** Live game period, e.g. 3 for third quarter (ESPN `status.period`). */
  period?: number;
  /** Raw ESPN status detail, e.g. "Q3 5:20", "Halftime", "Final". */
  statusDetail?: string;
  /** True when kickoff time is unconfirmed / TBD (e.g. Week 18). */
  isTbd?: boolean;
}
