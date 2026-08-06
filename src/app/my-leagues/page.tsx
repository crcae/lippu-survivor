"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarX,
  Crown,
  Plus,
  Search,
  ShieldAlert,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import {
  getCurrentUser,
  getUserEnrolledLeaguesInDb,
  type EnrolledLeague,
} from "@/lib/services/survivor-db";
import { ACTIVE_WEEK, SEASON_YEAR, getTeam } from "@/lib/mock-survivor-data";
import { formatMxn } from "@/lib/survivor-utils";
import type { NFLTeamId } from "@/types";

function pickLabel(pick?: NFLTeamId): string {
  if (!pick) return "Sin pick esta semana";
  return `W${ACTIVE_WEEK}: ${getTeam(pick).name}`;
}

function LeagueCard({
  league,
  actionable,
}: {
  league: EnrolledLeague;
  actionable: boolean;
}) {
  const progress =
    league.totalEntries > 0
      ? Math.round((league.remainingEntries / league.totalEntries) * 100)
      : 0;

  return (
    <Card variant="elevated" className="p-5 space-y-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary truncate">
            {league.leagueName}
          </h3>
          <p className="text-xs text-text-secondary truncate mt-0.5">
            Temporada {SEASON_YEAR}
            {league.userEntriesCount > 1
              ? ` · ${league.userEntriesCount} entradas`
              : ` · ${league.entryName}`}
          </p>
        </div>
        {league.isCommissioner ? (
          <Badge variant="warning" className="whitespace-nowrap">
            <Crown className="w-3 h-3" />
            Comisionado
          </Badge>
        ) : (
          <Badge variant="info" className="whitespace-nowrap">
            Jugador
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {league.isAlive ? (
            <Badge variant="success">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Vivo
            </Badge>
          ) : (
            <Badge variant="danger">
              <ShieldAlert className="w-3 h-3" />
              Eliminado
            </Badge>
          )}
          {league.leagueType === "paid" && league.entryFee ? (
            <Badge variant="default">
              <Wallet className="w-3 h-3" />
              {formatMxn(league.entryFee)}
            </Badge>
          ) : (
            <Badge variant="default">Gratis</Badge>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
          <Users className="w-3.5 h-3.5" />
          {league.remainingEntries}/{league.totalEntries} vivos
        </span>
      </div>

      {/* Progress: remaining participants */}
      <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current week pick */}
      <div className="rounded-xl bg-surface border border-border px-3.5 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Pick de la Semana {ACTIVE_WEEK}
        </p>
        <p className="text-sm font-semibold text-text-primary mt-0.5">
          {pickLabel(league.currentWeekPick)}
        </p>
      </div>

      <div className="mt-auto pt-1">
        {actionable ? (
          <Link href={`/league/${league.leagueId}`} className="block">
            <Button variant="primary" size="md" className="w-full">
              Hacer Pick
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : (
          <Link href={`/league/${league.leagueId}`} className="block">
            <Button variant="secondary" size="md" className="w-full">
              Ver Liga
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

export default function MyLeaguesPage() {
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<EnrolledLeague[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => (user ? getUserEnrolledLeaguesInDb(user.id) : []))
      .then((rows) => {
        if (!cancelled) setLeagues(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar tus ligas.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeLeagues = leagues.filter(
    (league) => league.leagueStatus === "active" && league.isAlive,
  );
  const endedLeagues = leagues.filter(
    (league) => league.leagueStatus !== "active" || !league.isAlive,
  );

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-10 w-52 rounded-xl bg-surface/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-border bg-surface/60 animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative space-y-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium mb-3">
              <Trophy className="w-4 h-4 text-primary" />
              Mis Ligas
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tus Ligas de Survivor
            </h1>
            <p className="text-text-secondary mt-2">
              Temporada {SEASON_YEAR} · {activeLeagues.length} activa
              {activeLeagues.length === 1 ? "" : "s"}
              {endedLeagues.length > 0
                ? ` · ${endedLeagues.length} finalizada${endedLeagues.length === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/league/join">
              <Button variant="secondary">
                <Search className="w-4 h-4" />
                Unirse con Código
              </Button>
            </Link>
            <Link href="/create-league">
              <Button variant="primary">
                <Plus className="w-4 h-4" />
                Crear Liga
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <Card className="border-danger/40 bg-danger/10">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        )}

        {leagues.length === 0 && !error ? (
          <Card variant="elevated" className="p-12 text-center space-y-4">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated border border-border mx-auto">
              <Trophy className="w-8 h-8 text-text-secondary" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                Aún no estás en ninguna liga
              </h2>
              <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
                Crea tu propia liga de Survivor, invita a tus amigos con el
                código, o únete a una liga pública para empezar a hacer tus
                picks.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/create-league">
                <Button variant="primary" size="lg">
                  Crear una Liga
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="secondary" size="lg">
                  Explorar Ligas
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* Active leagues */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-success/15 border border-success/30 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-success" />
                </span>
                <h2 className="text-xl font-bold text-text-primary">
                  Ligas Activas
                </h2>
              </div>

              {activeLeagues.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-sm text-text-secondary">
                    No tienes ligas activas en este momento.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeLeagues.map((league) => (
                    <LeagueCard
                      key={league.leagueId}
                      league={league}
                      actionable
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Ended / eliminated leagues */}
            {endedLeagues.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center">
                    <CalendarX className="w-4 h-4 text-text-secondary" />
                  </span>
                  <h2 className="text-xl font-bold text-text-primary">
                    Finalizadas / Eliminado
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {endedLeagues.map((league) => (
                    <LeagueCard
                      key={league.leagueId}
                      league={league}
                      actionable={false}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
