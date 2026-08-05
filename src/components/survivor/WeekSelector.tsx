"use client";

import { Check } from "lucide-react";
import { CalendarDays } from "lucide-react";

interface WeekSelectorProps {
  weeks: number[];
  currentWeek: number;
  completedWeeks: Set<number>;
  onChange: (week: number) => void;
}

export function WeekSelector({
  weeks,
  currentWeek,
  completedWeeks,
  onChange,
}: WeekSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Seleccionar Semana
        </h2>
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Semanas NFL"
      >
        {weeks.map((week) => {
          const isCurrent = week === currentWeek;
          const isCompleted = completedWeeks.has(week);

          return (
            <button
              key={week}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => onChange(week)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-200 focus-ring ${
                isCurrent
                  ? "bg-primary text-white border-primary shadow-glow"
                  : isCompleted
                    ? "bg-surface text-text-secondary border-border hover:border-primary/40 hover:text-text-primary"
                    : "bg-surface text-text-secondary border-border hover:border-primary/40 hover:text-text-primary"
              }`}
            >
              {isCompleted && !isCurrent && (
                <Check className="w-3.5 h-3.5 text-success" />
              )}
              {isCurrent && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              )}
              Semana {week}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { WeekSelectorProps };
