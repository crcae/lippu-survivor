/* ============================================
   Lippu Survivor — Formatting Utilities
   ============================================ */

import type { NFLGame, NFLTeamId } from "@/types";

/** Format a kickoff ISO timestamp as a compact "weekday HH:mm" label. */
export function formatKickoff(kickoffTime: string, now: number): string {
  const date = new Date(kickoffTime);
  const weekday = new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const isToday = date.toDateString() === new Date(now).toDateString();
  if (isToday) return `Hoy · ${time}`;

  const isPast = date.getTime() <= now;
  if (isPast) return `${capitalize(weekday)} · ${time}`;

  return `${capitalize(weekday)} ${time}`;
}

/**
 * Full, unambiguous kickoff date label, e.g. "Jue, 10 Sep 2026 • 20:20 hrs".
 * Includes weekday, day number, month, year and time so users always see
 * exactly WHEN a game takes place.
 */
export function formatFullGameDate(kickoffTime: string): string {
  const date = new Date(kickoffTime);
  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat("es-MX", { day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date);
  const year = new Intl.DateTimeFormat("es-MX", { year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${abbreviate(weekday)}, ${day} ${abbreviate(month)} ${year} • ${time} hrs`;
}

/** Human-friendly countdown until a kickoff, e.g. "2d 14h", "5h 12m". */
export function formatTimeLeft(kickoffTime: string, now: number): string {
  const diff = new Date(kickoffTime).getTime() - now;
  if (diff <= 0) return "Pick bloqueado";

  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Short label for a matchup, e.g. "vs KC" or "@ SF". */
export function formatMatchup(matchup: { isHome: boolean; opponentId: string }): string {
  return matchup.isHome
    ? `vs ${matchup.opponentId}`
    : `@ ${matchup.opponentId}`;
}

/** Resolve home/away relationship for a team inside a game. */
export function matchupForTeam(
  game: NFLGame,
  teamId: NFLTeamId,
): { isHome: boolean; opponentId: NFLTeamId } {
  const isHome = game.homeTeamId === teamId;
  return { isHome, opponentId: isHome ? game.awayTeamId : game.homeTeamId };
}

/** Compact score label, e.g. "24 - 17". Empty string when scores are absent. */
export function formatScore(game: NFLGame): string {
  if (game.homeScore === undefined || game.awayScore === undefined) return "";
  return `${game.homeScore} - ${game.awayScore}`;
}

/**
 * Human-readable game status, e.g. "Q3 05:20", "Medio tiempo",
 * "Final", "Pospuesto" or "Programado".
 */
export function formatGameStatus(game: NFLGame): string {
  switch (game.status) {
    case "final":
      return "Final";
    case "postponed":
      return "Pospuesto";
    case "in_progress": {
      const { period, clock, statusDetail } = game;

      if (statusDetail && statusDetail.toLowerCase().includes("halftime")) {
        return "Medio tiempo";
      }
      if (period && period > 0 && clock) {
        const label = period > 4 ? "OT" : `Q${period}`;
        return `${label} ${padClock(clock)}`;
      }
      return "En vivo";
    }
    default:
      return "Programado";
  }
}

/** Format a number as a compact currency string. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a league prize pool, e.g. "$2,400". */
export function formatPrizePool(amount: number): string {
  return formatMoney(amount);
}

/** Format an amount as Mexican pesos, e.g. "$50 MXN". */
export function formatMxn(amount: number): string {
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} MXN`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Trim to a clean capitalized 3-letter abbreviation, e.g. "sept." → "Sep". */
function abbreviate(value: string): string {
  const trimmed = value.replace(".", "").slice(0, 3);
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Normalize an ESPN game clock, e.g. "5:20" → "05:20". */
function padClock(clock: string): string {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(clock.trim());
  if (!match) return clock;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}
