"use client";

import { Crown } from "lucide-react";
import { Badge } from "@/components/ui";
import { getTeam } from "@/lib/mock-survivor-data";
import type { LeaderboardParticipant } from "@/types";

interface LeaderboardTableProps {
  participants: LeaderboardParticipant[];
  highlightEntryId?: string;
}

const rankStyles = [
  "text-warning",
  "text-text-secondary",
  "text-[#CD7F32]",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 text-xs font-bold ${rankStyles[rank - 1]}`}
      >
        {rank === 1 && <Crown className="w-3.5 h-3.5" />}
        {rank}
      </span>
    );
  }
  return <span className="text-xs font-semibold text-text-secondary">{rank}</span>;
}

export function LeaderboardTable({
  participants,
  highlightEntryId,
}: LeaderboardTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface/70 backdrop-blur-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Clasificación de la Liga
        </h2>
        <span className="text-xs text-text-secondary">
          {participants.length} participantes
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-text-secondary border-b border-border">
              <th className="px-5 py-3 font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Jugador</th>
              <th className="px-3 py-3 font-semibold">Estado</th>
              <th className="px-3 py-3 font-semibold">Strikes</th>
              <th className="px-3 py-3 font-semibold">Historial de Picks</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => {
              const rank = index + 1;
              const isHighlighted = highlightEntryId === participant.id;
              const isAlive = participant.status === "alive";

              return (
                <tr
                  key={participant.id}
                  className={[
                    "border-b border-border/50 last:border-b-0 transition-colors",
                    isHighlighted
                      ? "bg-primary/10 border-l-2 border-l-accent"
                      : "hover:bg-surface-elevated/50",
                  ].join(" ")}
                >
                  <td className="px-5 py-3.5">
                    <RankBadge rank={rank} />
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-text-primary">
                        {participant.name}
                        {isHighlighted && (
                          <span className="ml-2 text-[10px] font-bold text-accent uppercase">
                            Tú
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {participant.entryName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {isAlive ? (
                      <Badge
                        variant="success"
                        className="border-success/40 bg-success/10 text-success"
                      >
                        VIVO
                      </Badge>
                    ) : (
                      <Badge
                        variant="danger"
                        className="border-danger/40 bg-danger/10 text-danger"
                      >
                        ELIMINADO
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <span
                      className={`text-sm font-bold ${
                        participant.strikes > 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {participant.strikes}/1
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1">
                      {participant.pickHistory.map((teamId, weekIndex) => {
                        if (!teamId) {
                          return (
                            <span
                              key={weekIndex}
                              className="w-6 h-6 rounded-md bg-surface border border-border/50 text-[9px] text-text-secondary/50 flex items-center justify-center"
                              title={`Semana ${weekIndex + 1}: —`}
                            >
                              –
                            </span>
                          );
                        }
                        const team = getTeam(teamId);
                        return (
                          <span
                            key={weekIndex}
                            className="w-6 h-6 rounded-md text-[9px] font-bold text-white flex items-center justify-center shadow-sm ring-1 ring-white/15"
                            style={{ backgroundColor: team.primaryColor }}
                            title={`Semana ${weekIndex + 1}: ${team.city} ${team.name}`}
                          >
                            {team.abbreviation}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { LeaderboardTableProps };
