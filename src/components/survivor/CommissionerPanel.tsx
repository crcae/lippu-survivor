"use client";

import { useState } from "react";
import { Crown, Link2, Users } from "lucide-react";
import { Badge, Button, useToast } from "@/components/ui";
import type { LeagueStatus } from "@/types";

interface CommissionerPanelProps {
  inviteCode: string;
  /** Occupied entries in the league. */
  entryCount: number;
  /** `null`/`undefined` = unlimited capacity. */
  capacity: number | null | undefined;
  maxEntriesPerUser: number;
  leagueStatus: LeagueStatus;
}

function inviteUrl(inviteCode: string): string {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const base =
    configuredBase.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/league/join?invite=${inviteCode}`;
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) resolve();
      else reject(new Error("copy falló"));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Exclusive "👑 Panel de Comisionado" section shown only to the league owner.
 * Displays the invite code with a one-click copy button, capacity progress and
 * the league status.
 */
export function CommissionerPanel({
  inviteCode,
  entryCount,
  capacity,
  maxEntriesPerUser,
  leagueStatus,
}: CommissionerPanelProps) {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = inviteUrl(inviteCode);
    try {
      await copyText(url);
      setCopied(true);
      success("Enlace de invitación copiado.");
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      success(url);
    }
  };

  const isUnlimited = capacity === null || capacity === undefined;
  const progress =
    isUnlimited || capacity === 0
      ? 0
      : Math.min(100, Math.round((entryCount / (capacity as number)) * 100));

  return (
    <section className="rounded-2xl border-2 border-accent/50 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15 p-5 sm:p-6 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              👑 Panel de Comisionado
            </h2>
            <p className="text-xs text-text-secondary">
              Tú eres el dueño de esta liga.
            </p>
          </div>
        </div>

        <Badge
          variant={leagueStatus === "active" ? "success" : "default"}
          className="uppercase"
        >
          {leagueStatus === "active" ? "Liga Activa" : leagueStatus}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Invite code + copy */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Código de Invitación
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary">
              {inviteCode}
            </span>
            <Button variant="accent" size="sm" onClick={() => void handleCopy()}>
              <Link2 className="w-4 h-4" />
              {copied ? "¡Copiado!" : "Copiar Enlace"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Invita a tus amigos compartiendo el código o enlace directo.
          </p>
        </div>

        {/* Capacity */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Capacidad
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-info shrink-0" />
            <span className="text-xl font-bold text-text-primary">
              {entryCount} / {isUnlimited ? "∞" : (capacity as number)}
            </span>
            <span className="text-xs text-text-secondary">
              Entradas ocupadas
            </span>
          </div>
          {!isUnlimited && (
            <div className="mt-3 h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-xs text-text-secondary">
            Hasta {maxEntriesPerUser} entradas por jugador.
          </p>
        </div>
      </div>
    </section>
  );
}

export type { CommissionerPanelProps };
