"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NFLTeamId, WeekPicks } from "@/types";
const STORAGE_PREFIX = "lippu_survivor_picks_";

function getStorageKey(leagueId: string, entryId?: string): string {
  return entryId
    ? `${STORAGE_PREFIX}${leagueId}_${entryId}`
    : `${STORAGE_PREFIX}${leagueId}`;
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

interface UseSurvivorPicksOptions {
  /**
   * When `false`, picks live only in memory and are driven by the `seed`
   * argument. Use this for DB-backed leagues where Supabase is the source of
   * truth. Defaults to `true` (localStorage persistence, demo mode).
   */
  persist?: boolean;
}

/**
 * Track the user's weekly picks per league (and optionally per entry).
 *
 * Demo mode (`persist: true`) keeps picks in localStorage under
 * `lippu_survivor_picks_[leagueId]`, SSR/hydration safe. DB mode
 * (`persist: false`) re-hydrates from the `seed` argument whenever it changes,
 * so real leagues can feed Supabase picks straight into the hook.
 */
export function useSurvivorPicks(
  leagueId: string,
  seed?: WeekPicks,
  entryId?: string,
  options?: UseSurvivorPicksOptions,
) {
  const persist = options?.persist ?? true;
  const storageKey = getStorageKey(leagueId, entryId);

  const [picks, setPicks] = useState<WeekPicks>(() =>
    persist ? readPicks(storageKey, seed) : seed ?? {},
  );

  // Persist on every change (localStorage mode only).
  useEffect(() => {
    if (persist) writePicks(storageKey, picks);
  }, [persist, storageKey, picks]);

  // Re-hydrate when the league/entry or the DB-backed seed changes.
  useEffect(() => {
    const initial = setTimeout(() => {
      setPicks(persist ? readPicks(storageKey, seed) : seed ?? {});
    }, 0);
    return () => clearTimeout(initial);
  }, [persist, seed, storageKey]);

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
