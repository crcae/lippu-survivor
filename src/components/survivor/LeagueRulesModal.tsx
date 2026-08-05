"use client";

import { Ban, Lock, Repeat, ScrollText, Trophy } from "lucide-react";
import { Modal } from "@/components/ui";

interface LeagueRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RULES = [
  {
    icon: ScrollText,
    title: "1 Pick por Semana",
    description:
      "Cada jornada elige un equipo que creas que ganará su partido. Solo un equipo por semana.",
  },
  {
    icon: Lock,
    title: "Cierre al Kickoff",
    description:
      "El pick se bloquea automáticamente en el momento en que inicia el partido. No podrás cambiarlo después.",
  },
  {
    icon: Repeat,
    title: "Sin Repeticiones",
    description:
      "Un equipo usado no puede seleccionarse de nuevo en ninguna otra semana de la temporada.",
  },
  {
    icon: Ban,
    title: "Sistema de Strikes",
    description:
      "Si tu equipo pierde o empata, recibes un strike. Con un strike estás eliminado de la liga.",
  },
  {
    icon: Trophy,
    title: "Last Man Standing",
    description:
      "El ganador es el último sobreviviente: el jugador que siga vivo cuando los demás hayan sido eliminados.",
  },
];

export function LeagueRulesModal({ isOpen, onClose }: LeagueRulesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reglas de la Liga">
      <div className="space-y-4">
        <ol className="space-y-3">
          {RULES.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">
                  <span className="text-primary mr-1.5">{index + 1}.</span>
                  {title}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="rounded-2xl border border-accent/30 bg-primary/10 p-4 text-center text-xs text-accent font-medium">
          Sobrevive toda la temporada y reclama el premio acumulado.
        </p>
      </div>
    </Modal>
  );
}

export type { LeagueRulesModalProps };
