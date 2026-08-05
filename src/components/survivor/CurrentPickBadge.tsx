"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Check,
  Lock,
  RefreshCcw,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui";
import { getTeam } from "@/lib/mock-survivor-data";
import {
  formatGameStatus,
  formatKickoff,
  formatMatchup,
  formatScore,
  formatTimeLeft,
  matchupForTeam,
} from "@/lib/survivor-utils";
import type { NFLGame, NFLTeamId } from "@/types";
import { TeamMark } from "./TeamMark";

interface CurrentPickBadgeProps {
  week: number;
  pick: { teamId: NFLTeamId; game: NFLGame } | null;
  now: number;
  isConfirmed: boolean;
  onConfirm: () => void;
  onChange: () => void;
}

function isLocked(game: NFLGame, now: number): boolean {
  return (
    game.status !== "scheduled" ||
    new Date(game.startTime).getTime() <= now
  );
}

export function CurrentPickBadge({
  week,
  pick,
  now,
  isConfirmed,
  onConfirm,
  onChange,
}: CurrentPickBadgeProps) {
  const [nowLocal, setNowLocal] = useState(now);

  useEffect(() => {
    const id = setInterval(() => setNowLocal(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!pick) {
    return (
      <section className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-surface/60 p-6">
        <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center text-primary">
          <CalendarClock className="w-6 h-6" />
        </div>
        <div>
          <p className="font-semibold text-text-primary">
            Sin pick para la Semana {week}
          </p>
          <p className="text-sm text-text-secondary">
            Elige un equipo en la cuadrícula para confirmar tu pick.
          </p>
        </div>
      </section>
    );
  }

  const { teamId, game } = pick;
  const team = getTeam(teamId);
  const matchup = matchupForTeam(game, teamId);
  const locked = isLocked(game, nowLocal);

  const showScore = game.status === "in_progress" || game.status === "final";
  const score = showScore ? formatScore(game) : "";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-accent/40 bg-surface-elevated p-5 shadow-glow sm:p-6">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <TeamMark team={team} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-text-primary">
                {team.city} {team.name}
              </h3>
              {isConfirmed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/15 border border-success/40 text-success text-xs font-semibold">
                  <Check className="w-3 h-3" strokeWidth={3} />
                  Pick confirmado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 border border-warning/40 text-warning text-xs font-semibold">
                  Sin confirmar
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary">
              {formatMatchup(matchup)} · Semana {week}
            </p>

            {showScore ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border text-sm font-bold tabular-nums ${
                    game.status === "in_progress"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-border bg-surface text-text-primary"
                  }`}
                >
                  {game.status === "in_progress" && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                    </span>
                  )}
                  {score}
                  <span className="text-xs font-medium text-text-secondary">
                    · {formatGameStatus(game)}
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Kickoff {formatKickoff(game.startTime, nowLocal)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Kickoff timer / lock badge */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold ${
              locked
                ? "border-border bg-surface text-text-secondary"
                : "border-accent/40 bg-primary/15 text-accent"
            }`}
          >
            {locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Timer className="w-4 h-4 animate-pulse" />
            )}
            {locked
              ? "Pick bloqueado"
              : formatTimeLeft(game.startTime, nowLocal)}
          </div>

          {locked ? (
            <span className="text-xs text-text-secondary">
              {game.status === "final"
                ? "El partido terminó"
                : "El kickoff ya inició"}
            </span>
          ) : isConfirmed ? (
            <Button variant="accent" size="sm" onClick={onChange}>
              <RefreshCcw className="w-3.5 h-3.5" />
              Cambiar Pick
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onConfirm}>
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
              Confirmar Pick
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export type { CurrentPickBadgeProps };
