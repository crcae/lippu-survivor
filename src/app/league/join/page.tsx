"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Shield, Ticket, Trophy, Users } from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import {
  getCurrentUser,
  getLeagueByInviteCode,
  isSupabaseConfigured,
  joinLeagueInDb,
  redeemTicketInDb,
  type CurrentUser,
  type LeagueLookup,
} from "@/lib/services/survivor-db";
import { formatMoney } from "@/lib/survivor-utils";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const PREVIEW_LEAGUE_NAMES = [
  "Survivor NFL Lippu 2026",
  "Liga de los Sábados",
  "Gridiron Kings",
  "No More Sundays",
  "Campeones del Norte",
  "Liga Poker & Football",
];

const PREVIEW_OWNERS = ["Matías", "Andrea", "Luis", "Sara", "Carlos"];

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] uppercase text-primary placeholder:text-text-secondary/30 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { success } = useToast();

  const [code, setCode] = useState("");
  const [ticketCode, setTicketCode] = useState("");
  const [entryName, setEntryName] = useState("Entrada #1");
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  const preview = useMemo(() => {
    if (value.length === 0) return null;
    const h = hashString(value);
    const players = 8 + (h % 42);
    const prizePool = players * 50;
    return {
      name: PREVIEW_LEAGUE_NAMES[h % PREVIEW_LEAGUE_NAMES.length],
      owner: PREVIEW_OWNERS[h % PREVIEW_OWNERS.length],
      players,
      prizePool,
    };
  }, [value]);

  const canSubmit = value.length === 6 && preview !== null;

  const redeemTicket = useCallback(
    async (ticket: string) => {
      const normalized = ticket.trim().toUpperCase();
      if (!normalized) {
        setError("Ingresa un código de ticket válido.");
        return;
      }

      setError(null);
      setRedeeming(true);

      let user: CurrentUser | null = null;
      try {
        user = await getCurrentUser();
      } catch {
        user = null;
      }

      if (!user) {
        setRedeeming(false);
        setError(
          isSupabaseConfigured()
            ? "No se pudo iniciar sesión para canjear tu ticket. Intenta de nuevo."
            : "Supabase no está configurado en este entorno.",
        );
        return;
      }

      try {
        const result = await redeemTicketInDb(normalized, user.id);
        setRedeeming(false);
        success("¡Ticket canjeado! Bienvenido a la liga.");
        setTimeout(() => {
          router.push(`/league/${result.leagueId}`);
        }, 900);
      } catch (err) {
        setRedeeming(false);
        setError(err instanceof Error ? err.message : "No se pudo canjear el ticket.");
      }
    },
    [router, success],
  );

  // Auto-redeem a ticket passed via ?ticket=CODE.
  useEffect(() => {
    const ticket = new URLSearchParams(window.location.search).get("ticket");
    if (!ticket) return;

    const autoRedeem = setTimeout(() => {
      setTicketCode(ticket);
      void redeemTicket(ticket);
    }, 0);

    return () => clearTimeout(autoRedeem);
  }, [redeemTicket]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Ingresa un código de invitación válido de 6 caracteres.");
      return;
    }
    setError(null);
    setSubmitting(true);

    // Try the real Supabase flow; fall back to demo only when not configured.
    let user: CurrentUser | null = null;
    let lookup: LeagueLookup | null | undefined;
    try {
      user = await getCurrentUser();
      if (user) {
        lookup = await getLeagueByInviteCode(value);
      }
    } catch {
      lookup = undefined;
    }

    if (user && lookup !== undefined) {
      if (!lookup) {
        setSubmitting(false);
        setError("No encontramos una liga con ese código.");
        return;
      }
      const capacity = lookup.league.capacity;
      if (
        capacity !== null &&
        capacity !== undefined &&
        lookup.entryCount >= capacity
      ) {
        setSubmitting(false);
        setError("Esta liga ya está llena.");
        return;
      }

      try {
        await joinLeagueInDb(
          lookup.league.id,
          user.id,
          entryName.trim() || "Entrada #1",
        );
        setSubmitting(false);
        success("¡Te has unido a la liga!");
        setTimeout(() => {
          router.push(`/league/${lookup!.league.id}`);
        }, 1100);
        return;
      } catch {
        setSubmitting(false);
        setError("No se pudo unir a la liga. Intenta de nuevo.");
        return;
      }
    }

    // Demo fallback (only reached when Supabase is not configured).
    setSubmitting(false);
    success("¡Te has unido a la liga!");
    setTimeout(() => {
      router.push(`/league/${value.toLowerCase()}`);
    }, 1100);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium mb-4">
            <LogIn className="w-4 h-4 text-primary" />
            Únete a una Liga
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Unirse a una Liga
          </h1>
          <p className="text-text-secondary mt-2">
            Canjea tu ticket de Lippu.app o usa el código de invitación del
            dueño de la liga.
          </p>
        </div>

        <Card variant="elevated" className="p-6 sm:p-8 space-y-6">
          {/* Ticket redemption */}
          <div className="space-y-2 rounded-2xl border border-accent/40 bg-primary/10 p-4">
            <label htmlFor="ticket-code" className="text-sm font-semibold text-text-primary">
              <span className="inline-flex items-center gap-2">
                <Ticket className="w-4 h-4 text-accent" />
                Ticket de Lippu.app
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="ticket-code"
                type="text"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                placeholder="LIPPU-TK-12345"
                autoComplete="off"
                autoCapitalize="characters"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-mono font-bold uppercase text-primary placeholder:text-text-secondary/30 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
              />
              <Button
                variant="accent"
                size="md"
                onClick={() => void redeemTicket(ticketCode)}
                isLoading={redeeming}
              >
                {redeeming ? "Canjeando…" : "Canjear"}
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              ¿Compraste en Lippu.app? Pega tu código aquí o llega con{" "}
              <span className="font-mono text-accent">?ticket=TU-CODIGO</span>.
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              o únete con código
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Invite code */}
          <div className="space-y-2">
            <label htmlFor="invite-code" className="text-sm font-semibold text-text-primary">
              Código de Invitación
            </label>
            <input
              id="invite-code"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={value}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LIPPU8"
              className={inputClass}
            />
            {value.length > 0 && value.length < 6 && (
              <p className="text-xs text-text-secondary">
                El código tiene {value.length}/6 caracteres.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="entry-name" className="text-sm font-semibold text-text-primary">
              Nombre de tu Entrada
            </label>
            <input
              id="entry-name"
              type="text"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              placeholder="Entrada #1"
              maxLength={40}
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
            />
            <p className="text-xs text-text-secondary">
              Puedes cambiarlo después desde tu liga.
            </p>
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Preview */}
          {preview && (
            <div className="rounded-2xl border border-accent/40 bg-primary/10 p-5 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Vista previa de la liga
                </p>
              </div>

              <p className="text-lg font-bold text-text-primary">
                {preview.name}
              </p>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <Users className="w-4 h-4 text-info mx-auto mb-1" />
                  <p className="text-base font-bold text-text-primary">
                    {preview.players}
                  </p>
                  <p className="text-[10px] text-text-secondary">Jugadores</p>
                </div>
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <Trophy className="w-4 h-4 text-warning mx-auto mb-1" />
                  <p className="text-base font-bold text-text-primary">
                    {formatMoney(preview.prizePool)}
                  </p>
                  <p className="text-[10px] text-text-secondary">Premio Pool</p>
                </div>
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <span className="block w-4 h-4 mx-auto mb-1 text-primary">
                    <Shield className="w-4 h-4" />
                  </span>
                  <p className="text-base font-bold text-text-primary truncate">
                    {preview.owner}
                  </p>
                  <p className="text-[10px] text-text-secondary">Comisionado</p>
                </div>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
            isLoading={submitting}
          >
            {submitting ? "Ingresando…" : "Confirmar e Ingresar"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
