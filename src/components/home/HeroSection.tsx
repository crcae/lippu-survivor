import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Compass,
  Crosshair,
} from "lucide-react";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

const FEATURES = [
  { icon: CalendarDays, label: "18 Semanas" },
  { icon: Crosshair, label: "1 Pick por Semana" },
  { icon: BadgeCheck, label: "Cobros y Premios Automáticos" },
];

/**
 * Landing page hero — high-contrast sports-tech section with ambient glow,
 * grid overlay, bold CTA pair and a season metrics strip.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-950">
      {/* Ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.12),rgba(124,58,237,0.06)_45%,transparent_72%)]" />

      {/* Grid overlay, masked to fade at the bottom */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 100%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-16 sm:pt-20 pb-14 sm:pb-16 text-center">
        {/* Micro-badge */}
        <div className="flex justify-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            NFL Survivor Pool — Temporada {SEASON_YEAR}
          </div>
        </div>

        {/* Wordmark overline */}
        <p
          className="text-xs sm:text-sm font-black tracking-[0.3em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-white to-purple-400 mb-4 animate-fade-in-up"
          style={{ animationDelay: "0.05s" }}
        >
          LIPPU SURVIVOR
        </p>

        {/* Main title */}
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-white animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          SOBREVIVE
          <br />
          CADA SEMANA
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
            .
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-6 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          Crea tu liga privada o únete a ligas públicas. Haz tu pick semanal,
          evita la eliminación y llévate la bolsa acumulada.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/create-league"
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-bold text-zinc-950 bg-gradient-to-r from-emerald-400 to-emerald-300 ring-1 ring-inset ring-white/40 shadow-[0_0_35px_rgba(16,185,129,0.4)] hover:shadow-[0_0_55px_rgba(16,185,129,0.55)] hover:-translate-y-0.5 transition-all duration-300 focus-ring"
          >
            Crear mi Liga
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#public-leagues"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold text-zinc-100 border border-zinc-700 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-zinc-500 hover:-translate-y-0.5 transition-all duration-300 focus-ring"
          >
            <Compass className="w-5 h-5 text-emerald-400" />
            Explorar Ligas
          </a>
        </div>

        {/* Feature highlights strip */}
        <div
          className="mt-12 sm:mt-14 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-0 animate-fade-in-up"
          style={{ animationDelay: "0.3s" }}
        >
          {FEATURES.map((feature, index) => (
            <div
              key={feature.label}
              className={`flex items-center gap-2.5 px-0 sm:px-8 ${
                index > 0
                  ? "sm:border-l sm:border-zinc-800"
                  : ""
              }`}
            >
              <feature.icon className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold text-zinc-200">
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
