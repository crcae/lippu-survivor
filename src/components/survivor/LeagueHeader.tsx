"use client";

import {
  BookOpen,
  CircleDollarSign,
  History,
  Swords,
  Users,
} from "lucide-react";
import { Badge, FootballIcon } from "@/components/ui";
import type { SurvivorStatus } from "@/types";
import { formatPrizePool } from "@/lib/survivor-utils";
import {
  EntrySwitcher,
  type LeagueEntryOption,
} from "./EntrySwitcher";

interface LeagueHeaderProps {
  leagueName: string;
  status: SurvivorStatus;
  entries: LeagueEntryOption[];
  activeEntryId: string;
  onEntryChange: (entryId: string) => void;
  remainingEntries: number;
  totalEntries: number;
  strikes: number;
  strikesMax: number;
  prizePool: number;
  onOpenRules?: () => void;
  onOpenHistory?: () => void;
}

export function LeagueHeader({
  leagueName,
  status,
  entries,
  activeEntryId,
  onEntryChange,
  remainingEntries,
  totalEntries,
  strikes,
  strikesMax,
  prizePool,
  onOpenRules,
  onOpenHistory,
}: LeagueHeaderProps) {
  const isAlive = status === "alive";
  const strikesLeft = Math.max(strikesMax - strikes, 0);

  const metrics = [
    {
      label: "Entradas Activas",
      value: `${remainingEntries} / ${totalEntries}`,
      icon: Users,
      accent: "text-info",
    },
    {
      label: "Strikes Restantes",
      value: `${strikesLeft} / ${strikesMax}`,
      icon: Swords,
      accent: isAlive ? "text-success" : "text-danger",
    },
    {
      label: "Premio Estimado",
      value: formatPrizePool(prizePool),
      icon: CircleDollarSign,
      accent: "text-warning",
    },
  ];

  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* League identity */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-glow shrink-0">
            <FootballIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              {leagueName}
            </h1>
            <p className="text-sm text-text-secondary">
              Temporada 2026 · Liga privada
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Rules button */}
          {onOpenRules && (
            <button
              type="button"
              onClick={onOpenRules}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-transparent text-sm font-semibold text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/60 transition-all duration-200 focus-ring"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Reglas de la Liga</span>
              <span className="md:hidden">Reglas</span>
            </button>
          )}

          {/* History button */}
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-transparent text-sm font-semibold text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/60 transition-all duration-200 focus-ring"
            >
              <History className="w-4 h-4" />
              <span className="hidden md:inline">Mi Historial</span>
              <span className="md:hidden">Historial</span>
            </button>
          )}

          {/* Status badge */}
          {isAlive ? (
            <Badge
              variant="success"
              className="animate-pulse-glow border-success/40 bg-success/10 text-success px-3 py-1"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              VIVO
            </Badge>
          ) : (
            <Badge
              variant="danger"
              className="border-danger/40 bg-danger/10 text-danger px-3 py-1"
            >
              ELIMINADO
            </Badge>
          )}

          {/* Entry switcher */}
          <EntrySwitcher
            entries={entries}
            activeEntryId={activeEntryId}
            onChange={onEntryChange}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {metrics.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface/70 backdrop-blur-sm p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-card"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center shrink-0 ${accent}`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-text-secondary truncate">{label}</p>
              <p className="text-lg font-bold text-text-primary leading-tight">
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}

export type { LeagueHeaderProps };
