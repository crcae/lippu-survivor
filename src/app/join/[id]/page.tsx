"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Crown,
  Lock,
  LogIn,
  Percent,
  SearchX,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Button, Card, FootballIcon, Modal, useToast } from "@/components/ui";
import { KushkiPaymentForm } from "@/components/checkout/KushkiPaymentForm";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useAuth } from "@/context/AuthContext";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import {
  getLeaguePreviewInDb,
  joinLeagueInDb,
  type LeaguePreview,
} from "@/lib/services/survivor-db";
import { formatMxn } from "@/lib/survivor-utils";

const PLATFORM_FEE_PERCENT = 8;

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

export default function JoinLeaguePreviewPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params.id;

  const router = useRouter();
  const { success } = useToast();
  const requireAuth = useAuthGate();
  const searchParams = useSearchParams();
  const checkoutRequested = searchParams.get("checkout") === "true";
  const { profile, isGuest, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [entryName, setEntryName] = useState("Entrada #1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentUser, setPaymentUser] = useState<{
    id: string;
    email: string;
    displayName: string;
  } | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    getLeaguePreviewInDb(leagueId)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setPreview(data);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudo cargar la liga en este momento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  // Auto-open checkout when arriving from a paid-league CTA (?checkout=true).
  // Guests are sent to the login modal first; once they sign in (or come back
  // from the OAuth redirect), this re-runs and opens the payment form.
  useEffect(() => {
    if (!checkoutRequested || authLoading || !preview) return;
    const run = setTimeout(() => {
      if (isGuest) {
        requireAuth();
        return;
      }
      if (profile) {
        setPaymentUser({
          id: profile.id,
          email: profile.email,
          displayName: profile.displayName,
        });
        setPaymentOpen(true);
      }
    }, 0);
    return () => clearTimeout(run);
  }, [checkoutRequested, authLoading, isGuest, profile, preview, requireAuth]);

  const handleFreeJoin = async () => {
    if (!preview) return;
    // Mandatory sign-in: guests are sent to the login modal.
    if (!requireAuth()) return;
    setError(null);
    setSubmitting(true);

    if (!profile) {
      setSubmitting(false);
      setError("No se pudo iniciar sesión para unirte. Intenta de nuevo.");
      return;
    }

    try {
      await joinLeagueInDb(
        preview.league.id,
        profile.id,
        entryName.trim() || "Entrada #1",
      );
      setSubmitting(false);
      success("¡Te has unido a la liga!");
      setTimeout(() => {
        router.push(`/league/${preview.league.id}`);
      }, 1100);
    } catch (err) {
      setSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo unir a la liga. Intenta de nuevo.",
      );
    }
  };

  const handlePaidContinue = async () => {
    if (!preview) return;
    // Mandatory sign-in: guests are sent to the login modal before paying.
    if (!requireAuth()) return;
    setError(null);

    if (!profile) {
      setError(
        "No se pudo iniciar sesión para completar el pago. Intenta de nuevo.",
      );
      return;
    }

    setPaymentUser({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
    });
    setPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    if (!preview) return;
    success("¡Pago completado con éxito! Bienvenido a la liga.");
    setTimeout(() => {
      setPaymentOpen(false);
      router.push(`/league/${preview.league.id}`);
    }, 1500);
  };

  const isPaid = preview?.league.leagueType === "paid";
  const isActive = preview?.league.status === "active";

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-border bg-surface/60 animate-pulse"
          />
        ))}
      </main>
    );
  }

  if (notFound || !preview) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated border border-border mx-auto">
          <SearchX className="w-8 h-8 text-text-secondary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Liga no encontrada</h1>
        <p className="text-text-secondary">
          Esta liga no existe o el enlace es inválido.
        </p>
        <Button variant="primary" size="lg" onClick={() => router.push("/")}>
          Explorar Ligas
          <ArrowRight className="w-4 h-4" />
        </Button>
      </main>
    );
  }

  const league = preview.league;
  const isFull =
    league.capacity !== null &&
    league.capacity !== undefined &&
    preview.entryCount >= league.capacity;

  const platformFee = isPaid
    ? Number(((league.entryFee ?? 0) * (PLATFORM_FEE_PERCENT / 100)).toFixed(2))
    : 0;
  const totalToPay = isPaid
    ? Number(((league.entryFee ?? 0) + platformFee).toFixed(2))
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium mb-4">
            <LogIn className="w-4 h-4 text-primary" />
            Unirse a la Liga
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {league.name}
          </h1>
          <p className="text-text-secondary mt-2">
            Temporada {league.seasonYear} · {SEASON_YEAR === league.seasonYear ? "NFL Survivor Pool" : ""}
          </p>
        </div>

        <div className="space-y-6">
          {/* League header card */}
          <Card variant="elevated" className="p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {isPaid ? (
                <Badge variant="warning" className="border-warning/40 bg-warning/10 text-warning">
                  De Paga
                </Badge>
              ) : (
                <Badge variant="success" className="border-success/40 bg-success/10 text-success">
                  Gratis
                </Badge>
              )}
              <Badge variant="info">
                {preview.activeParticipants} jugador
                {preview.activeParticipants === 1 ? "" : "es"} activo
                {preview.activeParticipants === 1 ? "" : "s"}
              </Badge>
              {!isActive && <Badge variant="danger">No disponible</Badge>}
              {isFull && <Badge variant="danger">Liga llena</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface border border-border p-3 text-center">
                <Users className="w-4 h-4 text-info mx-auto mb-1" />
                <p className="text-base font-bold text-text-primary">
                  {preview.activeParticipants}
                </p>
                <p className="text-[10px] text-text-secondary">Activos</p>
              </div>
              <div className="rounded-xl bg-surface border border-border p-3 text-center">
                <Crown className="w-4 h-4 text-warning mx-auto mb-1" />
                <p className="text-base font-bold text-text-primary truncate" title={preview.ownerName}>
                  {preview.ownerName ?? "Comisionado"}
                </p>
                <p className="text-[10px] text-text-secondary">Comisionado</p>
              </div>
              <div className="rounded-xl bg-surface border border-border p-3 text-center">
                <FootballIcon className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-base font-bold text-text-primary">
                  {league.entryFee === 0 && league.leagueType === "free"
                    ? "Gratis"
                    : formatMxn(league.entryFee ?? 0)}
                </p>
                <p className="text-[10px] text-text-secondary">Entrada</p>
              </div>
            </div>

            {/* Current participants */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-text-primary">
                Jugadores actuales ({preview.entryCount})
              </p>
              {preview.participants.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Aún no hay jugadores. ¡Sé el primero en unirte!
                </p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {preview.participants.slice(0, 8).map((participant, index) => (
                    <li
                      key={`${participant.entryName}-${index}`}
                      className="flex items-center gap-2 rounded-lg bg-surface border border-border px-3 py-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                      <span className="text-sm text-text-primary truncate">
                        {participant.entryName}
                      </span>
                      {participant.status !== "alive" && (
                        <span className="text-[10px] text-text-secondary ml-auto">
                          Eliminado
                        </span>
                      )}
                    </li>
                  ))}
                  {preview.participants.length > 8 && (
                    <li className="text-xs text-text-secondary px-3 py-2">
                      +{preview.participants.length - 8} más…
                    </li>
                  )}
                </ul>
              )}
            </div>
          </Card>

          {/* Price breakdown (paid leagues) */}
          {isPaid && (
            <Card variant="elevated" className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold text-text-primary">
                  Desglose del Pago
                </h2>
              </div>

              <div className="rounded-2xl border border-border bg-surface overflow-hidden">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm text-text-secondary">Entrada a la bolsa</p>
                      <p className="text-xs text-text-secondary/70">100% al premio</p>
                    </div>
                    <span className="text-sm font-bold text-text-primary tabular-nums">
                      {formatMxn(league.entryFee ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                        <Percent className="w-3.5 h-3.5" />
                        Fee de servicio ({PLATFORM_FEE_PERCENT}%)
                      </p>
                      <p className="text-xs text-text-secondary/70">
                        Cargo de la plataforma
                      </p>
                    </div>
                    <span className="text-sm font-bold text-warning tabular-nums">
                      {formatMxn(platformFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 bg-primary/10">
                    <span className="text-sm font-semibold text-text-primary">
                      Total a pagar
                    </span>
                    <span className="text-lg font-bold text-accent tabular-nums">
                      {formatMxn(totalToPay)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-warning shrink-0" />
                <p className="text-sm text-text-secondary">
                  La bolsa total es de{" "}
                  <span className="font-bold text-warning">
                    {formatMxn((league.entryFee ?? 0) * preview.entryCount)}
                  </span>{" "}
                  y crece con cada jugador que se une.
                </p>
              </div>
            </Card>
          )}

          {/* Join CTA */}
          <Card variant="elevated" className="p-6 space-y-4">
            {!isActive ? (
              <div className="text-center">
                <Lock className="w-8 h-8 text-danger mx-auto mb-3" />
                <p className="font-semibold text-text-primary">
                  Esta liga no está aceptando jugadores.
                </p>
              </div>
            ) : isFull ? (
              <div className="text-center">
                <Lock className="w-8 h-8 text-danger mx-auto mb-3" />
                <p className="font-semibold text-text-primary">
                  Esta liga ya está llena.
                </p>
              </div>
            ) : isPaid ? (
              <div className="space-y-4">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handlePaidContinue}
                >
                  Pagar Entrada ({formatMxn(totalToPay)})
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="text-center text-xs text-text-secondary">
                  El pago se procesa de forma segura con Kushki. Recibirás tu
                  entrada al instante.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl px-4 py-2.5">
                    {error}
                  </p>
                )}

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleFreeJoin}
                  isLoading={submitting}
                >
                  {submitting ? "Uniéndote…" : "Unirme Gratis Ahora"}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </Button>
                <p className="text-center text-xs text-text-secondary">
                  Al unirte aceptas las reglas de la liga y de la temporada {SEASON_YEAR}.
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>

      <Modal
        isOpen={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
          setError(null);
        }}
        title={`Completa tu pago · ${formatMxn(totalToPay)}`}
      >
        {paymentUser && (
          <KushkiPaymentForm
            leagueId={league.id}
            leagueName={league.name}
            userId={paymentUser.id}
            userEmail={paymentUser.email}
            userName={paymentUser.displayName}
            entryName={entryName.trim() || "Entrada #1"}
            ticketAmount={league.entryFee ?? 0}
            platformFee={platformFee}
            totalAmount={totalToPay}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </Modal>
    </div>
  );
}
