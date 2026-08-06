"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Compass,
  Crown,
  Search,
  SearchX,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, FootballIcon } from "@/components/ui";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";
import {
  getPublicLeaguesInDb,
  type PublicLeague,
} from "@/lib/services/survivor-db";
import { formatMxn } from "@/lib/survivor-utils";

type LeagueFilter = "all" | "paid" | "free";

const FILTERS: { id: LeagueFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "paid", label: "De Paga" },
  { id: "free", label: "Gratis" },
];

export default function Home() {
  const [leagues, setLeagues] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeagueFilter>("all");

  useEffect(() => {
    let cancelled = false;
    getPublicLeaguesInDb()
      .then((data) => {
        if (cancelled) return;
        setLeagues(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          "No se pudieron cargar las ligas públicas en este momento. Intenta de nuevo más tarde.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLeagues = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leagues.filter((league) => {
      if (filter !== "all" && league.leagueType !== filter) return false;
      if (term && !league.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [leagues, search, filter]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Background Ambient Effects ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      {/* ── Hero Section ── */}
      <main className="relative z-10 flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="flex justify-center mb-8 animate-fade-in-up">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium">
              <FootballIcon className="w-4 h-4 text-primary" />
              NFL Survivor Pool — Temporada {SEASON_YEAR}
            </span>
          </div>

          <div className="text-center max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
              Lippu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                Survivor
              </span>{" "}
              {SEASON_YEAR}
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Crea tu liga privada o únete a ligas públicas. Sobrevive cada
              semana y llévate la bolsa acumulada.
            </p>
          </div>

          <div
            className="flex flex-wrap justify-center gap-4 mt-10 animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              href="/create-league"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-base hover:bg-primary-hover shadow-glow hover:shadow-glow-lg transition-all duration-300 focus-ring"
            >
              Crear mi Liga
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#public-leagues"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-white font-semibold text-base hover:bg-secondary-hover border border-border hover:border-border-hover transition-all duration-300 focus-ring"
            >
              <Compass className="w-4 h-4" />
              Explorar Ligas
            </a>
          </div>
        </section>

        {/* ── Public Leagues ── */}
        <section id="public-leagues" className="max-w-6xl mx-auto px-6 pb-24 scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Ligas Públicas
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Explora y únete a las ligas que están aceptando jugadores.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar liga por nombre…"
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200"
              />
            </div>
          </div>

          {/* Filter toggles */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 focus-ring ${
                  filter === item.id
                    ? item.id === "paid"
                      ? "bg-warning/15 border-warning/40 text-warning"
                      : item.id === "free"
                        ? "bg-success/15 border-success/40 text-success"
                        : "bg-primary border-primary text-white shadow-glow"
                    : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Grid / empty / loading states */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl border border-border bg-surface/60 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 p-10 text-center">
              <SearchX className="w-10 h-10 text-danger mx-auto mb-4" />
              <p className="font-semibold text-text-primary">{error}</p>
            </div>
          ) : visibleLeagues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/60 p-10 text-center">
              <SearchX className="w-10 h-10 text-text-secondary mx-auto mb-4" />
              <p className="font-semibold text-text-primary">
                {leagues.length === 0
                  ? "Aún no hay ligas públicas."
                  : "No encontramos ligas con esos filtros."}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {leagues.length === 0
                  ? "Sé el primero en crear una y empieza a jugar."
                  : "Prueba con otra búsqueda o cambia el filtro."}
              </p>
              {leagues.length === 0 && (
                <Link
                  href="/create-league"
                  className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover shadow-glow transition-all duration-300 focus-ring"
                >
                  Crear mi Liga
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleLeagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/join/${league.id}`}
                  className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-all duration-300 hover:border-accent/60 hover:-translate-y-0.5 hover:shadow-card focus-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-text-primary leading-tight line-clamp-2">
                      {league.name}
                    </h3>
                    {league.leagueType === "paid" ? (
                      <Badge variant="warning" className="shrink-0 border-warning/40 bg-warning/10 text-warning">
                        De Paga
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0 border-success/40 bg-success/10 text-success">
                        Gratis
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-elevated border border-border p-3">
                      <Wallet className="w-4 h-4 text-accent mb-1" />
                      <p className="text-xs text-text-secondary">Costo por entrada</p>
                      <p className="text-sm font-bold text-text-primary truncate">
                        {formatMxn(league.entryFee)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-elevated border border-border p-3">
                      <Trophy className="w-4 h-4 text-warning mb-1" />
                      <p className="text-xs text-text-secondary">Bolsa total</p>
                      <p className="text-sm font-bold text-text-primary truncate">
                        {formatMxn(league.totalPot)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                      <Users className="w-3.5 h-3.5" />
                      {league.activeParticipants}{" "}
                      {league.activeParticipants === 1 ? "jugador activo" : "jugadores activos"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 text-accent text-sm font-semibold group-hover:bg-primary/25 transition-colors">
                      Ver Liga / Unirse
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Why play ── */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="group bg-surface rounded-2xl border border-border p-6 hover:border-primary/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Crown className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Bolsa Acumulada</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                En las ligas de paga, cada entrada suma a la bolsa. Sobrevive
                hasta el final y llévatela toda.
              </p>
            </div>
            <div className="group bg-surface rounded-2xl border border-border p-6 hover:border-accent/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Trophy className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Picks Semanales</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Elige un equipo distinto cada semana antes del kickoff. Pierde
                una vez y estás fuera.
              </p>
            </div>
            <div className="group bg-surface rounded-2xl border border-border p-6 hover:border-success/40 hover:shadow-card transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Ligas Privadas</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Juega solo con tus amigos. Comparte tu enlace único y compite
                en tu propio grupo cerrado.
              </p>
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
