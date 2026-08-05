"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";

export interface LeagueEntryOption {
  id: string;
  name: string;
}

interface EntrySwitcherProps {
  entries: LeagueEntryOption[];
  activeEntryId: string;
  onChange: (entryId: string) => void;
}

/**
 * Dropdown/pill selector to switch the active multi-entry context.
 * Changing the entry re-scopes all picks (see `useSurvivorPicks`).
 */
export function EntrySwitcher({
  entries,
  activeEntryId,
  onChange,
}: EntrySwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeEntry =
    entries.find((entry) => entry.id === activeEntryId) ?? entries[0];

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  if (entries.length <= 1) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-border text-sm font-semibold text-text-primary">
        <Layers className="w-4 h-4 text-accent" />
        {activeEntry?.name ?? "Entrada"}
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-border text-sm font-semibold text-text-primary hover:border-primary/40 hover:bg-surface transition-all duration-200 focus-ring"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Cambiar entrada"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/20 text-xs font-bold text-accent shrink-0">
          {(activeEntry?.name ?? "E").match(/[0-9]/)?.[0] ?? "E"}
        </span>
        <span className="hidden sm:inline">{activeEntry?.name}</span>
        <span className="sm:hidden">Entrada</span>
        <ChevronDown
          className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 top-full mt-2 w-64 z-30 rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-elevated animate-fade-in"
        >
          {entries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(entry.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-colors focus-ring ${
                    isActive
                      ? "bg-primary/15 text-accent"
                      : "text-text-primary hover:bg-surface"
                  }`}
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-xs font-bold text-accent">
                    {entry.name.match(/[0-9]/)?.[0] ?? "E"}
                  </span>
                  <span className="flex-1 truncate">{entry.name}</span>
                  {isActive && <Check className="w-4 h-4 text-accent" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type { EntrySwitcherProps };
