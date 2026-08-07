"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Crown,
  Plus,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  getCurrentUser,
  getUserCommissionedLeaguesInDb,
  getUserEnrolledLeaguesInDb,
  type EnrolledLeague,
} from "@/lib/services/survivor-db";
import { ACTIVE_WEEK, getTeam } from "@/lib/mock-survivor-data";
import { formatMxn } from "@/lib/survivor-utils";
import type { NFLTeamId } from "@/types";

function pickLabel(pick?: NFLTeamId): string {
  if (!pick) return "Sin pick esta semana";
  return `W${ACTIVE_WEEK}: ${getTeam(pick).name}`;
}

/**
 * "Mis Ligas" dropdown in the top Navbar. Pulls every league the current user
 * is enrolled in OR commissions (deduped), each with role/status/type pills
 * and a direct link. Single "+ Crear nueva liga" CTA at the bottom.
 */
export function MyLeaguesDropdown() {
  const pathname = usePathname();
  const { isGuest, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<EnrolledLeague[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(async (user) => {
        if (!user) return [];
        // Leagues the user plays in + leagues they commission (including ones
        // they haven't joined yet). Dedupe by league id, preferring the
        // enrolled row which carries real entry data.
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
        if (cancelled) return;
        setLeagues(rows);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLeagues([]);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Navigations close the dropdown.
  useEffect(() => {
    const close = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(close);
  }, [pathname]);

  const isActive = pathname === "/my-leagues";
  const activeCount = leagues.filter(
    (league) => league.leagueStatus === "active",
  ).length;
  const counter = activeCount;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 focus-ring ${
          isActive
            ? "bg-primary/15 text-accent border border-primary/30"
            : "text-text-secondary hover:text-text-primary hover:bg-surface"
        }`}
      >
        <Trophy className="w-4 h-4" />
        <span className="whitespace-nowrap">Mis Ligas</span>
        {counter > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent/20 text-accent text-xs font-bold">
            {counter}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface-elevated shadow-elevated z-50 overflow-hidden animate-fade-in"
        >
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-text-primary">Mis Ligas</p>
            <p className="text-xs text-text-secondary">
              {loaded && leagues.length > 0
                ? `${counter} liga${counter === 1 ? "" : "s"} activa${counter === 1 ? "" : "s"}`
                : "Tus ligas aparecerán aquí"}
            </p>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-6 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-surface/60 border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : isGuest ? (
              <div className="px-4 py-8 text-center space-y-3">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface border border-border">
                  <Trophy className="w-6 h-6 text-text-secondary" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Inicia sesión para ver tus ligas
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    Accede con Google o tu correo para ver tus ligas y picks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAuth}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
                >
                  Iniciar Sesión
                </button>
              </div>
            ) : leagues.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-3">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface border border-border">
                  <Trophy className="w-6 h-6 text-text-secondary" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Aún no estás en ninguna liga
                  </p>
                  <p className="text-xs text-text-secondary mt-1">
                    Crea una liga o únete con un código para empezar.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="p-1.5 space-y-0.5">
                {leagues.map((league) => {
                  const notJoined =
                    league.isCommissioner && league.userEntriesCount === 0;
                  return (
                    <li key={league.leagueId}>
                      <Link
                        href={`/league/${league.leagueId}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface transition-colors"
                      >
                        <span className="shrink-0 mt-0.5">
                          {league.isCommissioner ? (
                            <Crown className="w-4 h-4 text-warning" />
                          ) : (
                            <UserRound className="w-4 h-4 text-info" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0 space-y-1">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-text-primary truncate">
                              {league.leagueName}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {league.leagueStatus === "active" ? (
                              <Badge
                                variant="success"
                                className="text-[10px] px-1.5 py-0"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                En vivo
                              </Badge>
                            ) : (
                              <Badge
                                variant="default"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Finalizada
                              </Badge>
                            )}
                            {league.leagueType === "paid" &&
                            league.entryFee ? (
                              <Badge
                                variant="warning"
                                className="text-[10px] px-1.5 py-0"
                              >
                                <Wallet className="w-2.5 h-2.5" />
                                {formatMxn(league.entryFee)}
                              </Badge>
                            ) : (
                              <Badge
                                variant="default"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Gratis
                              </Badge>
                            )}
                            {notJoined && (
                              <Badge
                                variant="warning"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Sin entrada
                              </Badge>
                            )}
                          </span>
                          <span className="block text-xs text-text-secondary">
                            {notJoined
                              ? "Únete para activar tu liga"
                              : pickLabel(league.currentWeekPick)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Link
              href="/create-league"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear nueva liga
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
