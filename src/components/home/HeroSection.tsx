import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

/**
 * Landing page hero — refined purple/violet brand aesthetic with a soft
 * ambient glow, balanced typography and a purple-to-indigo CTA pair.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-zinc-950">
      {/* Ambient purple radial glow behind the hero content */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(88,28,135,0.20),rgba(49,46,129,0.10)_45%,transparent_72%)]" />

      {/* Subtle grid overlay, masked to fade at the bottom */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 65% at 50% 0%, black 35%, transparent 100%)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 sm:pt-28 pb-20 sm:pb-24 text-center">
        {/* Micro-badge */}
        <div className="flex justify-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/40 border border-purple-800/40 text-xs text-purple-300">
            🏆 NFL Survivor Pool — Temporada {SEASON_YEAR}
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          Lippu <span className="text-purple-400">Survivor</span>{" "}
          <span className="text-zinc-500">· {SEASON_YEAR}</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-6 text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          Crea tu liga privada o únete a ligas públicas. Haz tu pick cada
          semana, evita la eliminación y recibe los cobros y premios
          automáticamente.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/create-league"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/25 hover:shadow-purple-500/40 transition-all cursor-pointer hover:-translate-y-0.5 focus-ring"
          >
            Crear mi Liga
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#public-leagues"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all cursor-pointer hover:-translate-y-0.5 focus-ring"
          >
            <Compass className="w-5 h-5 text-purple-400" />
            Explorar Ligas
          </a>
        </div>
      </div>
    </section>
  );
}
