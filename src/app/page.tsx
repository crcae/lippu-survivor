import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Play,
  Shield,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Background Ambient Effects ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      {/* ── Hero Section ── */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          {/* Hero Badge */}
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium">
              <Zap className="w-4 h-4 text-primary" />
              NFL Survivor Pool — {SEASON_YEAR} Season
            </span>
          </div>

          {/* Hero Title */}
          <div className="text-center max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              Bienvenido a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                Lippu Survivor
              </span>{" "}
              {SEASON_YEAR}
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Elige un equipo NFL cada semana. Si ganan, sobrevives. Pierde una
              vez y estás fuera. ¿Tienes lo que se necesita para sobrevivir toda
              la temporada?
            </p>
          </div>

          {/* CTA Buttons Row */}
          <div
            className="flex flex-wrap justify-center gap-4 mt-10 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            {/* Crear Liga */}
            <Link
              href="/league/create"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-hover shadow-glow hover:shadow-glow-lg transition-all duration-300 focus-ring"
            >
              Crear Liga
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            {/* Unirse a Liga */}
            <Link
              href="/league/join"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-white font-semibold text-base hover:bg-secondary-hover border border-border hover:border-border-hover transition-all duration-300 focus-ring"
            >
              Unirse a Liga
            </Link>

            {/* Probar Demo */}
            <Link
              href="/league/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-transparent text-accent font-semibold text-base border border-accent/30 hover:bg-accent/10 hover:border-accent/60 transition-all duration-300 focus-ring"
            >
              <Play className="w-4 h-4" />
              Probar Demo
            </Link>
          </div>
        </section>

        {/* ── Demo Banner ── */}
        <div className="max-w-6xl mx-auto px-6 pb-14">
          <Link
            href="/league/demo"
            className="group relative block overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-r from-surface-elevated via-primary/10 to-surface-elevated p-6 sm:p-8 shadow-elevated hover:border-accent/70 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: "0.25s" }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform duration-300 shrink-0">
                <Play className="w-7 h-7 text-white" />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-danger/15 border border-danger/40 text-danger text-xs font-bold">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
                    </span>
                    ESPN EN VIVO
                  </span>
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                    Ver Demo Interactiva
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary">
                  Explora el dashboard con marcadores reales
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  Cambia de semana, elige tu pick y mira los marcadores en vivo
                  de ESPN. Todo el sistema funcional, listo para probar.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-glow group-hover:bg-primary-hover transition-colors shrink-0">
                Probar Demo
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        </div>

        {/* ── Feature Cards ── */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            {/* Card 1 */}
            <div className="group relative bg-surface rounded-2xl border border-border p-6 hover:border-primary/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                Ligas Privadas
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Crea tu propia liga, invita a tus amigos y compite para ver
                quién es el último sobreviviente.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group relative bg-surface rounded-2xl border border-border p-6 hover:border-primary/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                Picks Semanales
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Selecciona tu equipo cada semana antes del kickoff. Cada equipo
                solo puede usarse una vez por temporada.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group relative bg-surface rounded-2xl border border-border p-6 hover:border-primary/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">
                Leaderboard en Vivo
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Sigue los resultados en tiempo real y mira quién sobrevive cada
                semana con nuestro leaderboard dinámico.
              </p>
            </div>
          </div>

          {/* ── Sample Surface Elevated Card ── */}
          <div
            className="mt-12 max-w-2xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="bg-surface-elevated rounded-2xl border border-border p-8 text-center shadow-elevated">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-5 animate-float">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                ¿Listo para la Temporada {SEASON_YEAR}?
              </h2>
              <p className="text-text-secondary mb-6 max-w-md mx-auto">
                Únete a miles de jugadores en la plataforma de Survivor más
                moderna de habla hispana. La temporada NFL {SEASON_YEAR} está
                por comenzar.
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-primary">32</span>
                  <span className="text-text-secondary">Equipos NFL</span>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-accent">18</span>
                  <span className="text-text-secondary">Semanas</span>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-success">1</span>
                  <span className="text-text-secondary">Sobreviviente</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/50 bg-surface/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
          <span>© {SEASON_YEAR} Lippu Survivor. Todos los derechos reservados.</span>
          <span className="text-xs text-border">survivor.lippu.app</span>
        </div>
      </footer>
    </div>
  );
}
