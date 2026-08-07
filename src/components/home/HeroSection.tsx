import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Compass } from "lucide-react";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

/**
 * Landing page hero — refined "Vibra Lippu" aesthetic built on the app's
 * design tokens (purple ambient glow, accent highlights and primary CTAs).
 * Features the Lippu Survivor logo badge integrated subtly above the headline.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle grid overlay, masked to fade at the bottom (page bg handled by the unified ambient layer in page.tsx) */}
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

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 sm:pb-16 text-center">
        {/* ── Logo badge ── */}
        <div className="flex justify-center mb-6 sm:mb-8 animate-fade-in-up">
          <div className="relative">
            {/* Ambient glow behind logo */}
            <div
              className="absolute inset-0 rounded-[2rem] blur-3xl opacity-40 animate-pulse-glow pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(124,58,237,0.5) 0%, rgba(124,58,237,0.15) 60%, transparent 100%)",
              }}
            />
            <Image
              src="/lippu-survivor-favicon.png"
              alt="Lippu Survivor"
              width={240}
              height={240}
              priority
              className="relative w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] lg:w-[220px] lg:h-[220px] object-contain drop-shadow-[0_0_40px_rgba(124,58,237,0.4)] animate-float"
            />
          </div>
        </div>

        {/* Micro-badge */}
        <div
          className="flex justify-center mb-6 animate-fade-in-up"
          style={{ animationDelay: "0.08s" }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs text-accent">
            🏆 NFL Survivor Pool — Temporada {SEASON_YEAR}
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary animate-fade-in-up"
          style={{ animationDelay: "0.14s" }}
        >
          Lippu <span className="text-accent">Survivor</span>{" "}
          <span className="text-text-secondary">· {SEASON_YEAR}</span>
        </h1>

        {/* Subheadline */}
        <p
          className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
          style={{ animationDelay: "0.18s" }}
        >
          Crea tu liga privada o únete a ligas públicas. Haz tu pick cada
          semana, evita la eliminación y recibe los cobros y premios
          automáticamente.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-10 animate-fade-in-up"
          style={{ animationDelay: "0.22s" }}
        >
          <Link
            href="/create-league"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-primary hover:bg-primary-hover text-white shadow-glow hover:shadow-glow-lg transition-all cursor-pointer hover:-translate-y-0.5 focus-ring"
          >
            Crear mi Liga
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#public-leagues"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold bg-surface border border-border hover:border-primary/40 text-text-primary transition-all cursor-pointer hover:-translate-y-0.5 focus-ring"
          >
            <Compass className="w-5 h-5 text-accent" />
            Explorar Ligas
          </a>
        </div>
      </div>
    </section>
  );
}

