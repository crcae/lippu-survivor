"use client";

import { BookOpen, History, Trophy } from "lucide-react";
import { FootballIcon } from "@/components/ui";

export type MobileNavTab = "pick" | "tabla" | "historial" | "reglas";

interface MobileNavProps {
  activeTab: MobileNavTab;
  onSelect: (tab: MobileNavTab) => void;
}

const TABS = [
  { id: "pick", label: "Pick", icon: FootballIcon },
  { id: "tabla", label: "Tabla", icon: Trophy },
  { id: "historial", label: "Historial", icon: History },
  { id: "reglas", label: "Reglas", icon: BookOpen },
] as const;

export function MobileNav({ activeTab, onSelect }: MobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-[#100719]/90 backdrop-blur-lg border-t border-[#3B2551] pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch justify-around">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] pt-1.5 pb-1.5 active:scale-95 transition-transform duration-150 focus-ring"
            >
              <span
                className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-colors duration-200 ${
                  isActive ? "bg-primary/15" : ""
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent shadow-glow" />
                )}
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isActive ? "text-accent" : "text-text-secondary"
                  }`}
                />
              </span>
              <span
                className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${
                  isActive ? "text-accent" : "text-text-secondary"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export type { MobileNavProps };
