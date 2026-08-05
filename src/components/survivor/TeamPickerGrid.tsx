"use client";

import { Check, Lock } from "lucide-react";
import { Badge } from "@/components/ui";
import { getTeam } from "@/lib/mock-survivor-data";
import {
  formatGameStatus,
  formatKickoff,
  formatMatchup,
  formatScore,
  matchupForTeam,
} from "@/lib/survivor-utils";
import type { NFLGame, NFLTeamId } from "@/types";
import { TeamMark } from "./TeamMark";

export type SurvivorDataSource = "espn" | "mock";

interface TeamPickerGridProps {
  week: number;
  games: NFLGame[];
  now: number;
  selectedTeamId: NFLTeamId | null;
  confirmedPickId: NFLTeamId | null;
  usedTeamWeeks: Record<NFLTeamId, number>;
  dataSource?: SurvivorDataSource;
  onSelect: (teamId: NFLTeamId) => void;
}

interface CardState {
  label: "selected" | "disabled" | "locked" | "available";
  usedWeek?: number;
}

function isLockedByTime(game: NFLGame, now: number): boolean {
  return (
    game.status !== "scheduled" ||
    new Date(game.startTime).getTime() <= now
  );
}

function resolveCardState(
  teamId: NFLTeamId,
  game: NFLGame,
  props: TeamPickerGridProps,
): CardState {
  const isConfirmed = props.confirmedPickId === teamId;
  const isTentative = props.selectedTeamId === teamId;

  if (isConfirmed || isTentative) {
    return { label: "selected" };
  }

  const usedWeek = props.usedTeamWeeks[teamId];
  if (usedWeek !== undefined) {
    return { label: "disabled", usedWeek };
  }

  return {
    label: isLockedByTime(game, props.now) ? "locked" : "available",
  };
}

function TeamGameInfo({
  game,
  now,
}: {
  game: NFLGame;
  now: number;
}) {
  if (game.status === "in_progress") {
    const score = formatScore(game);
    return (
      <div className="flex flex-col items-center gap-1 w-full">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-danger/15 border border-danger/40 text-danger text-[10px] font-bold">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
          </span>
          EN VIVO
        </span>
        <span className="text-xs font-bold text-text-primary tabular-nums">
          {score}
        </span>
        <span className="text-[10px] text-accent">
          {formatGameStatus(game)}
        </span>
      </div>
    );
  }

  if (game.status === "final") {
    const score = formatScore(game);
    return (
      <div className="flex flex-col items-center gap-1 w-full">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-text-secondary text-[10px] font-semibold">
          FINAL
        </span>
        <span className="text-xs font-bold text-text-primary tabular-nums">
          {score}
        </span>
      </div>
    );
  }

  if (game.status === "postponed") {
    return (
      <span className="text-[10px] text-warning font-semibold">
        Pospuesto
      </span>
    );
  }

  return (
    <span className="text-[10px] text-text-secondary">
      {formatKickoff(game.startTime, now)}
    </span>
  );
}

export function TeamPickerGrid(props: TeamPickerGridProps) {
  const { games, week, now, onSelect, dataSource = "mock" } = props;
  const isLiveSource = dataSource === "espn";

  const isLockedWeek =
    games.length > 0 &&
    games.every((game) => isLockedByTime(game, now));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Equipos Disponibles — Semana {week}
          </h2>

          {isLiveSource ? (
            <Badge variant="success" className="border-success/40 bg-success/10 text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              ESPN · En vivo
            </Badge>
          ) : (
            <Badge variant="warning" className="border-warning/40 bg-warning/10 text-warning">
              Datos de demostración
            </Badge>
          )}
        </div>

        {isLockedWeek && (
          <Badge variant="warning" className="border-warning/40">
            <Lock className="w-3 h-3" />
            Semana cerrada
          </Badge>
        )}
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
          <p className="font-semibold text-text-primary">
            No hay partidos para la Semana {week}
          </p>
          <p className="text-sm text-text-secondary">
            Los equipos con descanso (bye) no aparecen en esta semana.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
          {games.flatMap((game) => {
            const homeTeamId = game.homeTeamId;
            const awayTeamId = game.awayTeamId;

            return [homeTeamId, awayTeamId].map((teamId) => {
              const team = getTeam(teamId);
              const matchup = matchupForTeam(game, teamId);
              const state = resolveCardState(teamId, game, props);
              const canClick =
                state.label === "available" || state.label === "selected";

              const tooltip =
                state.label === "disabled" && state.usedWeek !== undefined
                  ? `Equipo ya utilizado en Semana ${state.usedWeek}`
                  : state.label === "locked"
                    ? "El partido ya comenzó"
                    : undefined;

              return (
                <button
                  key={`${game.id}-${teamId}`}
                  type="button"
                  disabled={!canClick}
                  title={tooltip}
                  onClick={() => onSelect(teamId)}
                  className={[
                    "group relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 focus-ring",
                    state.label === "selected"
                      ? "border-accent bg-primary/20 ring-1 ring-accent shadow-glow"
                      : state.label === "disabled"
                        ? "border-border bg-surface opacity-40 grayscale cursor-not-allowed"
                        : state.label === "locked"
                          ? "border-border bg-surface opacity-60 cursor-not-allowed"
                          : "border-border bg-surface hover:border-accent/60 hover:bg-surface-elevated hover:-translate-y-0.5 hover:shadow-card cursor-pointer",
                  ].join(" ")}
                >
                  {/* Status icon */}
                  {state.label === "selected" && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-glow">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                  {state.label === "locked" && (
                    <span className="absolute top-2 right-2 text-text-secondary">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}

                  <TeamMark team={team} size="md" className="mt-1" />

                  <span
                    className={`text-xs font-bold leading-tight ${
                      state.label === "selected"
                        ? "text-accent"
                        : "text-text-primary"
                    }`}
                  >
                    {team.abbreviation}
                  </span>
                  <span className="text-[10px] leading-tight text-text-secondary -mt-2 line-clamp-1">
                    {team.city}
                  </span>

                  <span className="text-xs font-semibold text-accent">
                    {formatMatchup(matchup)}
                  </span>

                  <TeamGameInfo game={game} now={now} />
                </button>
              );
            });
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-glow" />
          Seleccionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-2.5 h-2.5" />
          Kickoff iniciado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-border" />
          Utilizado
        </span>
      </div>
    </div>
  );
}

export type { TeamPickerGridProps };
