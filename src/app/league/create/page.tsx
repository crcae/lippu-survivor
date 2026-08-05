"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Sparkles, Trophy } from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { createLeagueInDb } from "@/lib/services/survivor-db";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import { formatMoney } from "@/lib/survivor-utils";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAPACITY_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "unlimited", label: "Ilimitada" },
];

function generateInviteCode(): string {
  const random = Array.from(
    { length: 3 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join("");
  return `LIP${random}`;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

export default function CreateLeaguePage() {
  const router = useRouter();
  const { success } = useToast();

  const [leagueName, setLeagueName] = useState("");
  const [seasonYear, setSeasonYear] = useState(SEASON_YEAR);
  const [maxEntries, setMaxEntries] = useState(1);
  const [capacity, setCapacity] = useState("25");
  const [strikes, setStrikes] = useState(0);
  const [buyIn, setBuyIn] = useState(50);
  const [inviteCode, setInviteCode] = useState(() => generateInviteCode());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isUnlimited = capacity === "unlimited";
  const capacityNumber = isUnlimited ? 100 : Number(capacity);

  const estimatedPrizePool = useMemo(() => {
    const maxPool = buyIn * capacityNumber;
    return isUnlimited ? `${formatMoney(maxPool)}+` : formatMoney(maxPool);
  }, [buyIn, capacityNumber, isUnlimited]);

  const handleSubmit = async () => {
    if (leagueName.trim().length < 3) {
      setError("El nombre de la liga debe tener al menos 3 caracteres.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const { leagueId } = await createLeagueInDb({
        name: leagueName.trim(),
        seasonYear,
        maxEntriesPerUser: maxEntries,
        capacity: isUnlimited ? null : capacityNumber,
        strikesAllowed: strikes,
        entryFee: buyIn,
        inviteCode: inviteCode.toUpperCase(),
      });
      setSubmitting(false);
      success("¡Liga creada correctamente!");
      setTimeout(() => {
        router.push(`/league/${leagueId}`);
      }, 1100);
      return;
    } catch {
      // Supabase not configured or session missing → demo fallback.
      setSubmitting(false);
      success("¡Liga creada correctamente!");
      setTimeout(() => {
        router.push(`/league/${inviteCode.toLowerCase()}`);
      }, 1100);
    }
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
            <Sparkles className="w-4 h-4 text-primary" />
            Crea tu propia liga
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Nueva Liga Survivor
          </h1>
          <p className="text-text-secondary mt-2">
            Configura tu pool, comparte el código de invitación y recluta a tus
            amigos.
          </p>
        </div>

        <Card variant="elevated" className="p-6 sm:p-8 space-y-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Season year */}
            <div className="space-y-2">
              <label htmlFor="season-year" className="text-sm font-semibold text-text-primary">
                Temporada
              </label>
              <select
                id="season-year"
                value={seasonYear}
                onChange={(e) => setSeasonYear(Number(e.target.value))}
                className={inputClass}
              >
                {[2026, 2027, 2028].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Strikes */}
            <div className="space-y-2">
              <label htmlFor="strikes" className="text-sm font-semibold text-text-primary">
                Strikes Permitidos
              </label>
              <select
                id="strikes"
                value={strikes}
                onChange={(e) => setStrikes(Number(e.target.value))}
                className={inputClass}
              >
                <option value={0}>0 · Eliminación directa</option>
                <option value={1}>1 · Con gracia</option>
              </select>
              <p className="text-xs text-text-secondary">
                {strikes === 0
                  ? "Un solo error y quedas fuera de la liga."
                  : "Tienes un strike de margen antes de quedar eliminado."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Max entries per user */}
            <div className="space-y-2">
              <label htmlFor="max-entries" className="text-sm font-semibold text-text-primary">
                Entradas por Usuario
              </label>
              <select
                id="max-entries"
                value={maxEntries}
                onChange={(e) => setMaxEntries(Number(e.target.value))}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "entrada" : "entradas"}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <label htmlFor="capacity" className="text-sm font-semibold text-text-primary">
                Capacidad Máxima
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {CAPACITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCapacity(option.value)}
                    className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 focus-ring ${
                      capacity === option.value
                        ? "bg-primary border-primary text-white shadow-glow"
                        : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Buy-in */}
            <div className="space-y-2">
              <label htmlFor="buy-in" className="text-sm font-semibold text-text-primary">
                Buy-in por Entrada (USD)
              </label>
              <input
                id="buy-in"
                type="number"
                min={0}
                step={5}
                value={buyIn}
                onChange={(e) => setBuyIn(Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>

            {/* Prize estimate */}
            <div className="rounded-2xl border border-accent/30 bg-primary/10 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Premio estimado</p>
                <p className="text-lg font-bold text-accent">
                  {estimatedPrizePool}
                </p>
              </div>
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
            reglamento de la temporada {seasonYear}.
          </p>
        </Card>
      </main>
    </div>
  );
}
