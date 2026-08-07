"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Crown,
  Search,
  SearchX,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { HeroSection } from "@/components/home/HeroSection";
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
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* ── Unified ambient glow: one continuous layer spanning the page, fading downward ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_48%_at_50%_-8%,rgba(88,28,135,0.22),rgba(49,46,129,0.10)_45%,transparent_78%)]" />
      </div>

      {/* ── Hero Section ── */}
      <main className="relative z-10 flex-1">
        <HeroSection />

        {/* ── Public Leagues ── */}
        <section id="public-leagues" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Ligas Públicas
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Explora y únete a las ligas que están aceptando jugadores.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar liga por nombre…"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all duration-200"
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
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] focus-ring ${
                  filter === item.id
                    ? "bg-purple-600 border-purple-500/60 text-white shadow-lg shadow-purple-600/20"
                    : "bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:border-purple-500/40 hover:text-white"
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
                  className="h-44 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/30 bg-zinc-900/50 p-10 text-center">
              <SearchX className="w-10 h-10 text-danger mx-auto mb-4" />
              <p className="font-semibold text-white">{error}</p>
            </div>
          ) : visibleLeagues.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
              <SearchX className="w-10 h-10 text-zinc-500 mx-auto mb-4" />
              <p className="font-semibold text-white">
                {leagues.length === 0
                  ? "Aún no hay ligas públicas."
                  : "No encontramos ligas con esos filtros."}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {leagues.length === 0
                  ? "Sé el primero en crear una y empieza a jugar."
                  : "Prueba con otra búsqueda o cambia el filtro."}
              </p>
              {leagues.length === 0 && (
                <Link
                  href="/create-league"
                  className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/25 transition-all duration-200 cursor-pointer active:scale-[0.98] focus-ring"
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
                  className="group relative flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm p-5 transition-all duration-200 hover:border-purple-500/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-950/40 focus-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">
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
                    <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-3">
                      <Wallet className="w-4 h-4 text-purple-400 mb-1" />
                      <p className="text-xs text-zinc-500">Costo por entrada</p>
                      <p className="text-sm font-bold text-white truncate">
                        {formatMxn(league.entryFee)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-3">
                      <Trophy className="w-4 h-4 text-purple-400 mb-1" />
                      <p className="text-xs text-zinc-500">Bolsa total</p>
                      <p className="text-sm font-bold text-white truncate">
                        {formatMxn(league.totalPot)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <Users className="w-3.5 h-3.5" />
                      {league.activeParticipants}{" "}
                      {league.activeParticipants === 1 ? "jugador activo" : "jugadores activos"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 text-purple-300 text-sm font-semibold group-hover:bg-purple-500/25 transition-colors">
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
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="group bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800/80 p-6 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-950/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                <Crown className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Bolsa Acumulada</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                En las ligas de paga, cada entrada suma a la bolsa. Sobrevive
                hasta el final y llévatela toda.
              </p>
            </div>
            <div className="group bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800/80 p-6 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-950/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                <Trophy className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Picks Semanales</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Elige un equipo distinto cada semana antes del kickoff. Pierde
                una vez y estás fuera.
              </p>
            </div>
            <div className="group bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800/80 p-6 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-950/40 transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ligas Privadas</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Juega solo con tus amigos. Comparte tu enlace único y compite
                en tu propio grupo cerrado.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400">
          <span>© {SEASON_YEAR} Lippu Survivor. Todos los derechos reservados.</span>
          <span className="text-xs text-zinc-600">survivor.lippu.app</span>
        </div>
      </footer>
    </div>
  );
}
