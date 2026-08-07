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
import { useAuth } from "@/context/AuthContext";
import {
  getCurrentUser,
  getUserCommissionedLeaguesInDb,
  getUserEnrolledLeaguesInDb,
  type EnrolledLeague,
} from "@/lib/services/survivor-db";
import { ACTIVE_WEEK, SEASON_YEAR, getTeam } from "@/lib/mock-survivor-data";
import { formatMxn } from "@/lib/survivor-utils";
import type { NFLTeamId } from "@/types";

type MyLeaguesTab = "activas" | "comisionado" | "finalizadas";

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

  // Commissioner who hasn't joined their own league yet (e.g. unpaid paid league).
  const notJoined = league.isCommissioner && league.userEntriesCount === 0;

  return (
    <Card variant="elevated" className="p-5 space-y-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-text-primary truncate">
            {league.leagueName}
          </h3>
          <p className="text-xs text-text-secondary truncate mt-0.5">
            Temporada {SEASON_YEAR}
            {notJoined
              ? " · Sin entrada todavía"
              : league.userEntriesCount > 1
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
          {notJoined ? (
            <Badge variant="default">
              <span className="w-1.5 h-1.5 rounded-full bg-text-secondary" />
              Sin entrada
            </Badge>
          ) : league.isAlive ? (
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
      {!notJoined && (
        <div className="rounded-xl bg-surface border border-border px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Pick de la Semana {ACTIVE_WEEK}
          </p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">
            {pickLabel(league.currentWeekPick)}
          </p>
        </div>
      )}

      <div className="mt-auto pt-1">
        {notJoined ? (
          <Link
            href={
              league.leagueType === "paid"
                ? `/join/${league.leagueId}?checkout=true`
                : `/join/${league.leagueId}`
            }
            className="block"
          >
            <Button variant="accent" size="md" className="w-full">
              {league.leagueType === "paid"
                ? "Pagar Entrada y Activar"
                : "Unirme a Mi Liga"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : actionable ? (
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring ${
        active
          ? "bg-primary/15 text-accent border border-primary/30 shadow-glow"
          : "text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

export default function MyLeaguesPage() {
  const { profile, isGuest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<EnrolledLeague[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MyLeaguesTab>("activas");

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(async (user) => {
        if (!user) return [];
        // Merge leagues the user plays in with leagues they commission
        // (including leagues they haven't joined yet). Dedupe by league id,
        // preferring the enrolled row which carries real entry data.
        const [enrolled, commissioned] = await Promise.all([
          getUserEnrolledLeaguesInDb(user.id),
          getUserCommissionedLeaguesInDb(user.id),
        ]);
        const byId = new Map<string, EnrolledLeague>();
        for (const row of enrolled) byId.set(row.leagueId, row);
        for (const row of commissioned) {
          if (!byId.has(row.leagueId)) byId.set(row.leagueId, row);
        }
        return [...byId.values()];
      })
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
    (league) => league.leagueStatus === "active",
  );
  const commissionerLeagues = leagues.filter(
    (league) => league.isCommissioner,
  );
  const endedPlayerLeagues = leagues.filter(
    (league) => league.leagueStatus !== "active" && !league.isCommissioner,
  );

  const visibleLeagues =
    tab === "activas"
      ? activeLeagues
      : tab === "comisionado"
        ? commissionerLeagues
        : endedPlayerLeagues;

  const tabCounts: Record<MyLeaguesTab, number> = {
    activas: activeLeagues.length,
    comisionado: commissionerLeagues.length,
    finalizadas: endedPlayerLeagues.length,
  };

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
              Mi Cuenta y Ligas
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Mi Cuenta y Ligas
            </h1>
            <p className="text-text-secondary mt-2">
              Temporada {SEASON_YEAR} · {activeLeagues.length} liga
              {activeLeagues.length === 1 ? "" : "s"} activa
              {activeLeagues.length === 1 ? "" : "s"}
              {commissionerLeagues.length > 0
                ? ` · ${commissionerLeagues.length} como comisionado`
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

        {/* Profile card */}
        <Card variant="elevated" className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-purple-600/30 shrink-0">
              {(profile?.displayName?.[0] || "L").toUpperCase()}
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-text-secondary">
                Cuenta
              </p>
              <h2 className="text-2xl font-bold text-text-primary truncate">
                {profile?.displayName || profile?.email?.split("@")[0] || "Jugador"}
              </h2>
              <p className="text-sm text-text-secondary truncate mt-0.5">
                {isGuest
                  ? "Inicia sesión para sincronizar tu cuenta"
                  : (profile?.email ?? "")}
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                <Badge variant="success">
                  <Trophy className="w-3 h-3" />
                  {activeLeagues.length} Liga
                  {activeLeagues.length === 1 ? "" : "s"} Activa
                  {activeLeagues.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="warning">
                  <Crown className="w-3 h-3" />
                  {commissionerLeagues.length} Comisionado
                  {commissionerLeagues.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="info">
                  <Users className="w-3 h-3" />
                  Jugador
                </Badge>
              </div>
            </div>
          </div>
        </Card>

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
            {/* Tabs */}
            <div className="flex flex-col sm:flex-row gap-2">
              <TabButton
                active={tab === "activas"}
                onClick={() => setTab("activas")}
              >
                Ligas Activas ({tabCounts.activas})
              </TabButton>
              <TabButton
                active={tab === "comisionado"}
                onClick={() => setTab("comisionado")}
              >
                Mis Ligas como Comisionado ({tabCounts.comisionado})
              </TabButton>
              {endedPlayerLeagues.length > 0 && (
                <TabButton
                  active={tab === "finalizadas"}
                  onClick={() => setTab("finalizadas")}
                >
                  Finalizadas ({tabCounts.finalizadas})
                </TabButton>
              )}
            </div>

            {/* Tab content */}
            <section className="space-y-4">
              {visibleLeagues.length === 0 ? (
                <Card className="text-center py-10">
                  <p className="text-sm text-text-secondary">
                    {tab === "activas"
                      ? "No tienes ligas activas en este momento."
                      : tab === "comisionado"
                        ? "Aún no comisiones ninguna liga."
                        : "No tienes ligas finalizadas."}
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleLeagues.map((league) => (
                    <LeagueCard
                      key={league.leagueId}
                      league={league}
                      actionable={tab === "activas" && league.isAlive}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Ended / eliminated sub-section inside the active tab */}
            {tab === "activas" &&
              activeLeagues.length > 0 &&
              endedPlayerLeagues.length > 0 && (
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
                    {endedPlayerLeagues.map((league) => (
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
