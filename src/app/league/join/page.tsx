"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LogIn, Search, Trophy, Users } from "lucide-react";
import { Badge, Button, Card, FootballIcon, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import {
  getLeagueByInviteCode,
  joinLeagueInDb,
  type LeagueLookup,
} from "@/lib/services/survivor-db";
import { formatMoney } from "@/lib/survivor-utils";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-2xl font-mono font-bold tracking-[0.4em] uppercase text-primary placeholder:text-text-secondary/30 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

export default function JoinLeaguePage() {
  const router = useRouter();
  const { success } = useToast();
  const { profile } = useAuth();
  const requireAuth = useAuthGate();

  const [code, setCode] = useState("");
  const [entryName, setEntryName] = useState("Entrada #1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Supabase invite code lookup state (no mock preview)
  const [validatedLeague, setValidatedLeague] = useState<LeagueLookup | null>(null);
  const [validating, setValidating] = useState(false);

  const value = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  // Live lookup on Supabase leagues table by invite_code
  useEffect(() => {
    let cancelled = false;
    const run = setTimeout(() => {
      if (value.length < 6) {
        setValidatedLeague(null);
        setError(null);
        return;
      }

      setValidating(true);
      setError(null);

      getLeagueByInviteCode(value)
        .then((lookup) => {
          if (cancelled) return;
          setValidating(false);
          if (lookup) {
            setValidatedLeague(lookup);
            setError(null);
          } else {
            setValidatedLeague(null);
            setError("Código de invitación no encontrado");
          }
        })
        .catch(() => {
          if (cancelled) return;
          setValidating(false);
          setValidatedLeague(null);
          setError("Código de invitación no encontrado");
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(run);
    };
  }, [value]);

  const canSubmit = value.length === 6 && validatedLeague !== null && !validating;

  // Pre-fill the code when arriving via an invitation link copied from the
  // commissioner panel (?invite=CODE).
  useEffect(() => {
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (!invite) return;

    const prefill = setTimeout(() => {
      setCode(invite.toUpperCase());
    }, 0);

    return () => clearTimeout(prefill);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !validatedLeague) {
      setError("Código de invitación no encontrado");
      return;
    }
    // Mandatory sign-in: guests are sent to the login modal.
    if (!requireAuth()) {
      setError("Inicia sesión para unirte a la liga.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const league = validatedLeague.league;

    if (
      league.capacity !== null &&
      league.capacity !== undefined &&
      validatedLeague.entryCount >= league.capacity
    ) {
      setSubmitting(false);
      setError("Esta liga ya está llena.");
      return;
    }

    // Paid leagues route through the Kushki checkout (`/join/[id]`), never the
    // free-join path.
    if (league.leagueType === "paid") {
      setSubmitting(false);
      router.push(`/join/${league.id}?checkout=true`);
      return;
    }

    if (!profile) {
      setSubmitting(false);
      setError("No se pudo iniciar sesión para unirte. Intenta de nuevo.");
      return;
    }

    try {
      await joinLeagueInDb(
        league.id,
        profile.id,
        entryName.trim() || "Entrada #1",
      );
      setSubmitting(false);
      success("¡Te has unido a la liga!");
      setTimeout(() => {
        router.push(`/league/${league.id}`);
      }, 1100);
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo unir a la liga. Intenta de nuevo.",
      );
    }
  }, [
    canSubmit,
    validatedLeague,
    requireAuth,
    profile,
    entryName,
    router,
    success,
  ]);

  const isPaid = validatedLeague?.league.leagueType === "paid";
  const entryFee = validatedLeague?.league.entryFee ?? 0;

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
            Usa el código de invitación que te dio el comisionado de la liga.
          </p>
        </div>

        <Card variant="elevated" className="p-6 sm:p-8 space-y-6">
          {error && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

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
            <p className="text-xs text-text-secondary">
              Introduce el código de 6 caracteres que te dio el comisionado.
            </p>
            {value.length > 0 && value.length < 6 && (
              <p className="text-xs text-text-secondary">
                El código tiene {value.length}/6 caracteres.
              </p>
            )}
            {validating && (
              <p className="text-xs text-accent animate-pulse">
                Buscando liga en tiempo real…
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

          {/* League Preview Card */}
          {validatedLeague && (
            <div className="rounded-2xl border border-accent/40 bg-primary/10 p-5 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <FootballIcon className="w-5 h-5 text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Liga Encontrada
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-bold text-text-primary">
                  {validatedLeague.league.name}
                </p>
                <Badge variant={isPaid ? "warning" : "success"}>
                  {isPaid ? formatMoney(entryFee) : "Gratis"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <Users className="w-4 h-4 text-info mx-auto mb-1" />
                  <p className="text-base font-bold text-text-primary">
                    {validatedLeague.entryCount}
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    Jugador{validatedLeague.entryCount === 1 ? "" : "es"}
                  </p>
                </div>
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <Trophy className="w-4 h-4 text-warning mx-auto mb-1" />
                  <p className="text-base font-bold text-text-primary">
                    {isPaid
                      ? formatMoney(
                          entryFee * (validatedLeague.activeParticipants || 1),
                        )
                      : "—"}
                  </p>
                  <p className="text-[10px] text-text-secondary">Premio Pool</p>
                </div>
                <div className="rounded-xl bg-surface border border-border p-3 text-center">
                  <span className="block w-4 h-4 mx-auto mb-1 text-primary">
                    <FootballIcon className="w-4 h-4" />
                  </span>
                  <p className="text-base font-bold text-text-primary truncate">
                    {validatedLeague.ownerName ?? "Comisionado"}
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
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            isLoading={submitting}
          >
            {submitting ? (
              "Ingresando…"
            ) : isPaid && validatedLeague ? (
              <>
                Pagar Entrada y Unirme (
                {formatMoney(
                  (validatedLeague.league.entryFee ?? 0) +
                    (validatedLeague.league.entryFee ?? 0) * 0.08,
                )}
                )
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Unirme a la Liga Gratis
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
          {!canSubmit && value.length === 6 && !validating && !error && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-secondary">
              <Search className="w-3.5 h-3.5" />
              Introduce un código válido para ver la liga.
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
