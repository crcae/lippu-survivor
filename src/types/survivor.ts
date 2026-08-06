/* ============================================
   Lippu Survivor — Dashboard Type Definitions
   ============================================ */

import type { EntryStatus, NFLTeamId } from "./index";

// ── User Status ──

export type SurvivorStatus = "alive" | "eliminated";

// ── Weekly Matchup (team perspective) ──

export interface WeekMatchup {
  week: number;
  teamId: NFLTeamId;
  opponentId: NFLTeamId;
  isHome: boolean;
  kickoffTime: string;
}

// ── League Dashboard Metrics ──

export interface LeagueStats {
  totalEntries: number;
  remainingEntries: number;
  strikes: number;
  strikesMax: number;
  prizePool: number;
}

// ── Leaderboard ──

export interface LeaderboardParticipant {
  id: string;
  /** Owner (`user_id`) of the entry — used to mark the commissioner. */
  userId: string;
  name: string;
  entryName: string;
  status: EntryStatus;
  strikes: number;
  pickHistory: (NFLTeamId | null)[];
}

// ── Picks Map ──

export type WeekPicks = Record<number, NFLTeamId>;
