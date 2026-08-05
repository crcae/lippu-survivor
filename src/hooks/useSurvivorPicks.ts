"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NFLTeamId, WeekPicks } from "@/types";
const STORAGE_PREFIX = "lippu_survivor_picks_";

function getStorageKey(leagueId: string): string {
  return `${STORAGE_PREFIX}${leagueId}`;
}

function readPicks(key: string, seed?: WeekPicks): WeekPicks {
  if (typeof window === "undefined") return seed ?? {};
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as WeekPicks;
      }
    }
  } catch {
    // Corrupted or inaccessible storage — fall through to seed.
  }
  return seed ?? {};
}

function writePicks(key: string, picks: WeekPicks): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(picks));
  } catch {
    // Storage unavailable or full — ignore.
  }
}

/**
 * Persist the user's weekly picks per league in localStorage under
 * `lippu_survivor_picks_[leagueId]`, SSR/hydration safe.
 */
export function useSurvivorPicks(leagueId: string, seed?: WeekPicks) {
  const storageKey = getStorageKey(leagueId);

  const [picks, setPicks] = useState<WeekPicks>(() =>
    readPicks(storageKey, seed),
  );

  // Persist on every change.
  useEffect(() => {
    writePicks(storageKey, picks);
  }, [storageKey, picks]);

  // Re-hydrate if the league changes without remounting.
  const previousKeyRef = useRef(storageKey);
  useEffect(() => {
    const initial = setTimeout(() => {
      if (previousKeyRef.current !== storageKey) {
        previousKeyRef.current = storageKey;
        setPicks(readPicks(storageKey, seed));
      }
    }, 0);
    return () => clearTimeout(initial);
  }, [seed, storageKey]);

  const getPickForWeek = useCallback(
    (week: number): NFLTeamId | null => picks[week] ?? null,
    [picks],
  );

  const confirmPick = useCallback((week: number, teamId: NFLTeamId) => {
    setPicks((prev) => ({ ...prev, [week]: teamId }));
  }, []);

  const hasUsedTeam = useCallback(
    (teamId: NFLTeamId, excludeWeek?: number): boolean => {
      return Object.entries(picks).some(
        ([week, usedTeam]) =>
          usedTeam === teamId && Number(week) !== excludeWeek,
      );
    },
    [picks],
  );

  const resetPicks = useCallback(() => {
    setPicks({});
  }, []);

  return useMemo(
    () => ({
      picks,
      getPickForWeek,
      confirmPick,
      hasUsedTeam,
      resetPicks,
    }),
    [picks, getPickForWeek, confirmPick, hasUsedTeam, resetPicks],
  );
}

export type { WeekPicks };
