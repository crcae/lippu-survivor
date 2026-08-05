"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon, X } from "lucide-react";
import { getNflGames } from "@/lib/espn";
import {
  SEASON_YEAR,
  WEEK_NUMBERS,
  getTeam,
} from "@/lib/mock-survivor-data";
import {
  formatMatchup,
  matchupForTeam,
} from "@/lib/survivor-utils";
import type {
  NFLGame,
  NFLTeamId,
  PickResult,
  WeekPicks,
} from "@/types";
import { TeamMark } from "./TeamMark";

interface PickHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  picks: WeekPicks;
  currentWeek: number;
}

function resolveResult(
  pickedTeam: NFLTeamId,
  game: NFLGame,
): PickResult {
  if (game.status !== "final") return "pending";
  if (game.homeScore === undefined || game.awayScore === undefined) {
    return "pending";
  }
  const isHome = game.homeTeamId === pickedTeam;
  const pickedScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;

  if (pickedScore > opponentScore) return "win";
  if (pickedScore < opponentScore) return "loss";
  return "push";
}

const resultStyles: Record<PickResult, { label: string; className: string }> = {
  win: {
    label: "WIN",
    className: "bg-success/15 border-success/40 text-success",
  },
  loss: {
    label: "LOSS",
    className: "bg-danger/15 border-danger/40 text-danger",
  },
  push: {
    label: "EMPATE",
    className: "bg-info/15 border-info/40 text-info",
  },
  pending: {
    label: "PENDIENTE",
    className: "bg-warning/15 border-warning/40 text-warning",
  },
};

export function PickHistoryDrawer({
  isOpen,
  onClose,
  picks,
  currentWeek,
}: PickHistoryDrawerProps) {
  const [weekGames, setWeekGames] = useState<Record<number, NFLGame>>({});
  const [results, setResults] = useState<Record<number, PickResult>>({});

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const weeksWithPicks = WEEK_NUMBERS.filter(
      (week) => week <= currentWeek && picks[week] !== undefined,
    );

    if (weeksWithPicks.length === 0) return;

    Promise.allSettled(
      weeksWithPicks.map((week) =>
        getNflGames(week, SEASON_YEAR).then((result) => ({ week, result })),
      ),
    ).then((settled) => {
      if (cancelled) return;

      const nextGames: Record<number, NFLGame> = {};
      const nextResults: Record<number, PickResult> = {};

      settled.forEach((entry, index) => {
        const week = weeksWithPicks[index];

        if (entry.status === "fulfilled") {
          const { result } = entry.value;
          const teamId = picks[week];
          const game = result.games.find(
            (g) => g.homeTeamId === teamId || g.awayTeamId === teamId,
          );
          if (game) {
            nextGames[week] = game;
            nextResults[week] = resolveResult(teamId, game);
            return;
          }
        }
        nextResults[week] = "pending";
      });

      setWeekGames(nextGames);
      setResults(nextResults);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentWeek, picks]);

  if (!isOpen) return null;

  const historyWeeks = WEEK_NUMBERS.filter(
    (week) => week <= currentWeek,
  ).reverse();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Mi historial de picks"
        className="relative flex h-full w-full flex-col border-l border-border bg-surface-elevated shadow-elevated animate-drawer-in sm:max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-text-primary">
              Mi Historial
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface transition-colors focus-ring"
            aria-label="Cerrar historial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-text-secondary">
              Semanas 1 a {currentWeek} · Temporada {SEASON_YEAR}
            </span>
          </div>

          {historyWeeks.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No hay historial disponible.
            </p>
          ) : (
            <ol className="relative space-y-2">
              {historyWeeks.map((week) => {
                const pickedTeam = picks[week];
                const game = weekGames[week];
                const isCurrentWeek = week === currentWeek;
                const loading = pickedTeam !== undefined && game === undefined;
                const result = results[week];

                return (
                  <li
                    key={week}
                    className={`relative flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${
                      isCurrentWeek
                        ? "border-accent/40 bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    {/* Week badge */}
                    <span
                      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                        isCurrentWeek
                          ? "bg-primary text-white shadow-glow"
                          : "bg-surface-elevated text-text-secondary"
                      }`}
                    >
                      S{week}
                    </span>

                    {pickedTeam === undefined ? (
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-secondary/70">
                          Sin pick
                        </p>
                        <p className="text-xs text-text-secondary/60">
                          No seleccionaste equipo esta semana
                        </p>
                      </div>
                    ) : (
                      <>
                        <TeamMark team={getTeam(pickedTeam)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary truncate">
                            {getTeam(pickedTeam).city}{" "}
                            {getTeam(pickedTeam).name}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {game
                              ? formatMatchup(
                                  matchupForTeam(game, pickedTeam),
                                )
                              : "Cargando…"}
                          </p>
                        </div>

                        {loading ? (
                          <span className="shrink-0 w-16 h-6 rounded-full bg-surface-elevated border border-border animate-pulse" />
                        ) : result ? (
                          <span
                            className={`shrink-0 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${resultStyles[result].className}`}
                          >
                            {resultStyles[result].label}
                          </span>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

export type { PickHistoryDrawerProps };
