"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, Sparkles } from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { createLeagueInDb } from "@/lib/services/survivor-db";
import { getSupabaseEnv } from "@/lib/supabase/client";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAPACITY_PRESETS = [10, 50, 100, 500];
const CUSTOM = "custom";
const UNLIMITED = "unlimited";

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
  const { success, error: toastError } = useToast();

  const [leagueName, setLeagueName] = useState("");
  const [capacityMode, setCapacityMode] = useState<string>("50");
  const [customCapacity, setCustomCapacity] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [inviteCode, setInviteCode] = useState(() => generateInviteCode());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isUnlimited = capacityMode === UNLIMITED;
  const isCustom = capacityMode === CUSTOM;

  const resolveCapacity = (): number | null => {
    if (isUnlimited) return null;
    if (isCustom) {
      const parsed = Number.parseInt(customCapacity, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return Number.parseInt(capacityMode, 10);
  };

  const handleSubmit = async () => {
    if (leagueName.trim().length < 3) {
      setError("El nombre de la liga debe tener al menos 3 caracteres.");
      return;
    }

    if (isCustom) {
      const parsed = Number.parseInt(customCapacity, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10_000) {
        setError("Ingresa una capacidad válida (entre 1 y 10,000 jugadores).");
        return;
      }
    }

    setError(null);
    setSubmitting(true);

    try {
      const { leagueId } = await createLeagueInDb({
        name: leagueName.trim(),
        seasonYear: SEASON_YEAR,
        capacity: resolveCapacity(),
        strikesAllowed: strikes,
        inviteCode: inviteCode.toUpperCase(),
      });
      setSubmitting(false);
      success("¡Liga creada correctamente!");
      setTimeout(() => {
        router.push(`/league/${leagueId}`);
      }, 1100);
    } catch (err) {
      setSubmitting(false);

      const message =
        err instanceof Error && err.message
          ? err.message
          : String(err ?? "Error desconocido al crear la liga.");

      // Unmask the exact runtime error in the console for debugging.
      console.error("[Create League Error]", err);

      // If env vars are missing at runtime, surface which ones are missing.
      const { missingVars } = getSupabaseEnv();
      if (missingVars.length > 0) {
        const envMessage = `Error: Faltan las variables ${missingVars.join(", ")} en Vercel.`;
        console.error("[Create League Error] Env check:", { missingVars });
        setError(envMessage);
        toastError(envMessage);
        return;
      }

      // Real Supabase error → show the exact message, never a static fallback.
      setError(message);
      toastError(message);
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
            amigos. La monetización se gestiona en Lippu.app.
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

          {/* Season + Strikes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-primary">
                Temporada
              </label>
              <div className="rounded-xl border border-accent/40 bg-primary/10 px-4 py-2.5 text-sm text-accent font-bold">
                NFL {SEASON_YEAR}
              </div>
              <p className="text-xs text-text-secondary">
                Los datos de partidos provienen en vivo de ESPN.
              </p>
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

          {/* Capacity */}
          <div className="space-y-2">
            <label htmlFor="capacity" className="text-sm font-semibold text-text-primary">
              Capacidad de la Liga
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {CAPACITY_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCapacityMode(String(value))}
                  className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 focus-ring ${
                    capacityMode === String(value)
                      ? "bg-primary border-primary text-white shadow-glow"
                      : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
                  }`}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCapacityMode(CUSTOM)}
                className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 focus-ring ${
                  isCustom
                    ? "bg-primary border-primary text-white shadow-glow"
                    : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                Custom
              </button>
              <button
                type="button"
                onClick={() => setCapacityMode(UNLIMITED)}
                className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 focus-ring ${
                  isUnlimited
                    ? "bg-primary border-primary text-white shadow-glow"
                    : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                Ilimitada
              </button>
            </div>

            {isCustom && (
              <div className="mt-3 space-y-1.5 animate-fade-in-up">
                <label htmlFor="custom-capacity" className="text-xs font-semibold text-text-secondary">
                  Capacidad personalizada
                </label>
                <input
                  id="custom-capacity"
                  type="number"
                  min={1}
                  max={10000}
                  value={customCapacity}
                  onChange={(e) => setCustomCapacity(e.target.value)}
                  placeholder="Ej. 250"
                  className={inputClass}
                />
              </div>
            )}

            <p className="text-xs text-text-secondary pt-1">
              {isUnlimited
                ? "Sin límite de jugadores."
                : isCustom
                  ? "Define cuántos jugadores pueden unirse."
                  : `Hasta ${capacityMode} jugadores.`}
            </p>
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
      </main>
    </div>
  );
}
