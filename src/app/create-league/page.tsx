"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dices,
  Eye,
  EyeOff,
  Percent,
  Receipt,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import { createLeagueInDb } from "@/lib/services/survivor-db";
import { useAuthGate } from "@/hooks/useAuthGate";
import { APP_BASE_URL, formatMxn } from "@/lib/survivor-utils";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLATFORM_FEE_PERCENT = 8;
const ESTIMATED_PLAYERS = 10;

function generateInviteCode(): string {
  const random = Array.from(
    { length: 3 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");
  return `LIP${random}`;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none";

type LeagueType = "free" | "paid";

export default function CreateLeaguePage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const requireAuth = useAuthGate();

  const [leagueName, setLeagueName] = useState("");
  const [leagueType, setLeagueType] = useState<LeagueType>("free");
  const [entryFee, setEntryFee] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState(() => generateInviteCode());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const entryFeeNumber = useMemo(() => {
    if (leagueType === "free") return 0;
    const parsed = Number(entryFee.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [entryFee, leagueType]);

  const platformFee = entryFeeNumber * (PLATFORM_FEE_PERCENT / 100);
  const totalToPay = entryFeeNumber + platformFee;
  const estimatedPot = entryFeeNumber * ESTIMATED_PLAYERS;

  const handleSubmit = async () => {
    if (leagueName.trim().length < 3) {
      setError("El nombre de la liga debe tener al menos 3 caracteres.");
      return;
    }
    if (leagueType === "paid" && entryFeeNumber <= 0) {
      setError("Ingresa un costo por entrada válido para la liga de paga.");
      return;
    }

    // Mandatory sign-in: guests are sent to the login modal.
    if (!requireAuth()) {
      setError("Inicia sesión para crear tu liga.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const { leagueId } = await createLeagueInDb({
        name: leagueName.trim(),
        seasonYear: SEASON_YEAR,
        capacity: null,
        strikesAllowed: 0,
        entryFee: entryFeeNumber,
        leagueType,
        isPublic,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        inviteCode: inviteCode.toUpperCase(),
      });
      setSubmitting(false);

      const shareUrl = `${APP_BASE_URL}/join/${leagueId}`;
      success(
        leagueType === "paid"
          ? "¡Liga creada! Ahora paga tu entrada para activar tu liga."
          : `¡Liga creada! Comparte tu enlace: ${shareUrl}`,
      );
      setTimeout(() => {
        router.push(
          leagueType === "paid"
            ? `/join/${leagueId}?checkout=true`
            : `/league/${leagueId}`,
        );
      }, 1800);
    } catch (err) {
      setSubmitting(false);
      const message =
        err instanceof Error && err.message
          ? err.message
          : String(err ?? "Error desconocido al crear la liga.");
      console.error("[Create League Error]", err);
      setError(message);
      toastError(message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <main className="relative z-10 flex-1 w-full mx-auto px-4 sm:px-6 py-10 max-w-5xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            Crea tu propia liga
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Nueva Liga Survivor
          </h1>
          <p className="text-text-secondary mt-2">
            Define el tipo de liga, el costo por entrada y quién podrá verla.
            Invita a tus amigos con tu enlace único.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* ── Form ── */}
          <Card variant="elevated" className="p-6 sm:p-8 space-y-6 lg:col-span-3">
            {/* League name */}
            <div className="space-y-2">
              <label htmlFor="league-name" className="text-sm font-semibold text-text-primary">
                Nombre de la Liga
              </label>
              <input
                id="league-name"
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="Ej. Liga de los Sábados"
                className={inputClass}
                maxLength={40}
              />
            </div>

            {/* League type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Tipo de Liga
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLeagueType("free")}
                  aria-pressed={leagueType === "free"}
                  className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-ring ${
                    leagueType === "free"
                      ? "border-success bg-success/10 shadow-glow"
                      : "border-border bg-surface hover:border-success/50"
                  }`}
                >
                  <p className="font-bold text-text-primary">Gratis ($0 MXN)</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Sin costo de entrada. Ideal para jugar con amigos.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLeagueType("paid")}
                  aria-pressed={leagueType === "paid"}
                  className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-ring ${
                    leagueType === "paid"
                      ? "border-warning bg-warning/10 shadow-glow"
                      : "border-border bg-surface hover:border-warning/50"
                  }`}
                >
                  <p className="font-bold text-text-primary">De Paga</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Definir costo por entrada y acumular una bolsa.
                  </p>
                </button>
              </div>
            </div>

            {/* Entry fee */}
            <div className="space-y-2">
              <label htmlFor="entry-fee" className="text-sm font-semibold text-text-primary">
                Costo por Entrada (MXN)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm font-semibold">
                  $
                </span>
                <input
                  id="entry-fee"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  placeholder={leagueType === "paid" ? "Ej. 50" : "0"}
                  disabled={leagueType === "free"}
                  className={`${inputClass} pl-8`}
                />
              </div>
              {leagueType === "free" && (
                <p className="text-xs text-text-secondary">
                  Las ligas gratis no cobran entrada, el costo por boleto es $0 MXN.
                </p>
              )}
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Visibilidad
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  aria-pressed={isPublic}
                  className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-ring ${
                    isPublic
                      ? "border-accent bg-accent/10 shadow-glow"
                      : "border-border bg-surface hover:border-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-accent" />
                    <p className="font-bold text-text-primary">Pública</p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Aparece en la página principal para que cualquiera se una.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  aria-pressed={!isPublic}
                  className={`rounded-2xl border-2 p-4 text-left transition-all duration-200 focus-ring ${
                    !isPublic
                      ? "border-primary bg-primary/10 shadow-glow"
                      : "border-border bg-surface hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-primary" />
                    <p className="font-bold text-text-primary">Privada</p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Solo accesible con tu enlace o código de invitación.
                  </p>
                </button>
              </div>
            </div>

            {/* Invite code */}
            <div className="space-y-2">
              <label htmlFor="invite-code" className="text-sm font-semibold text-text-primary">
                Código de Invitación
              </label>
              <div className="flex gap-2">
                <input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  readOnly
                  className={`${inputClass} font-mono tracking-[0.3em] uppercase text-primary font-bold`}
                />
                <Button
                  variant="accent"
                  size="md"
                  onClick={() => setInviteCode(generateInviteCode())}
                  title="Generar otro código"
                >
                  <Dices className="w-4 h-4" />
                  <span className="hidden sm:inline">Generar</span>
                </Button>
              </div>
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
              onClick={handleSubmit}
              isLoading={submitting}
            >
              {submitting ? "Creando liga…" : "Crear Liga"}
            </Button>

            <p className="text-center text-xs text-text-secondary">
              Al crear la liga aceptas las{" "}
              <span className="text-accent font-semibold">Reglas del Survivor</span> y el
              reglamento de la temporada {SEASON_YEAR}.
            </p>
          </Card>

          {/* ── Real-time Financial Calculator ── */}
          <Card variant="elevated" className="p-6 sm:p-8 space-y-5 lg:col-span-2 lg:sticky lg:top-20">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">
                Calculadora de Costos
              </h2>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="text-sm text-text-secondary">Costo por Boleto</span>
                  <span className="text-sm font-bold text-text-primary tabular-nums">
                    {formatMxn(entryFeeNumber)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
                    <Percent className="w-3.5 h-3.5" />
                    Comisión de Plataforma ({PLATFORM_FEE_PERCENT}%)
                  </span>
                  <span className="text-sm font-bold text-warning tabular-nums">
                    {formatMxn(platformFee)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 p-4 bg-primary/10">
                  <span className="text-sm font-semibold text-text-primary">
                    Total a pagar por jugador
                  </span>
                  <span className="text-lg font-bold text-accent tabular-nums">
                    {formatMxn(totalToPay)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-warning" />
                <p className="text-sm font-semibold text-text-primary">
                  Bolsa Estimada para el Ganador
                </p>
              </div>
              <p className="text-2xl font-bold text-warning tabular-nums">
                {formatMxn(estimatedPot)}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Con {ESTIMATED_PLAYERS} jugadores · {formatMxn(entryFeeNumber)} ×{" "}
                {ESTIMATED_PLAYERS}. La bolsa crece con cada jugador que se une.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                <Users className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <p>
                  El 100% de la entrada va a la bolsa. La comisión del{" "}
                  {PLATFORM_FEE_PERCENT}% es un cargo de servicio por jugador.
                </p>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                <Shield className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p>
                  {isPublic
                    ? "Tu liga es pública y aparecerá en la página principal."
                    : "Tu liga es privada y solo se accede con tu enlace."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
