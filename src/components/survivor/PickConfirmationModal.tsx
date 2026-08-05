"use client";

import { AlertTriangle, Check, Clock, Lock } from "lucide-react";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui";
import {
  formatKickoff,
  formatMatchup,
  formatTimeLeft,
  matchupForTeam,
} from "@/lib/survivor-utils";
import type { NFLGame, NFLTeam } from "@/types";
import { TeamMark } from "./TeamMark";

interface PickConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  team: NFLTeam;
  game: NFLGame;
  week: number;
  now: number;
}

export function PickConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  team,
  game,
  week,
  now,
}: PickConfirmationModalProps) {
  const matchup = matchupForTeam(game, team.id);
  const opponent = matchup.isHome ? game.awayTeamId : game.homeTeamId;
  const locked =
    game.status !== "scheduled" ||
    new Date(game.startTime).getTime() <= now;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Confirmar pick · Semana ${week}`}
    >
      <div className="space-y-5">
        {/* Team + matchup */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
          <TeamMark team={team} size="lg" />
          <div>
            <p className="font-bold text-text-primary">
              {team.city} {team.name}
            </p>
            <p className="text-sm text-accent font-semibold">
              {formatMatchup(matchup)}
              <span className="text-text-secondary"> · {opponent}</span>
            </p>
          </div>
        </div>

        {/* Kickoff */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-text-secondary">Kickoff:</span>
          <span className="font-semibold text-text-primary">
            {formatKickoff(game.startTime, now)}
          </span>
          {!locked && (
            <span className="inline-flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-full bg-primary/15 border border-accent/40 text-accent text-xs font-semibold">
              <Clock className="w-3 h-3 animate-pulse" />
              {formatTimeLeft(game.startTime, now)}
            </span>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary leading-relaxed">
            Una vez guardado, no podrás seleccionar a{" "}
            <span className="font-bold">{team.name}</span> en ninguna otra
            semana de la temporada 2026.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm}>
            <Check className="w-4 h-4" strokeWidth={3} />
            Confirmar Selección
          </Button>
        </div>

        {locked && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-warning">
            <Lock className="w-3.5 h-3.5" />
            Este pick se bloqueará porque el partido ya comenzó.
          </p>
        )}
      </div>
    </Modal>
  );
}

export type { PickConfirmationModalProps };
