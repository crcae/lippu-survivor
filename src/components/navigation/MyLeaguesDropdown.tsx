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
  X,
} from "lucide-react";
import { Badge } from "@/components/ui";
import {
  getCurrentUser,
  getUserEnrolledLeaguesInDb,
  type EnrolledLeague,
} from "@/lib/services/survivor-db";
import { ACTIVE_WEEK, getTeam } from "@/lib/mock-survivor-data";
import type { NFLTeamId } from "@/types";

function pickLabel(pick?: NFLTeamId): string {
  if (!pick) return "Sin pick esta semana";
  return `W${ACTIVE_WEEK}: ${getTeam(pick).name}`;
}

/**
 * "Mis Ligas" dropdown in the top Navbar. Lists every league the current user
 * is enrolled in (active first, alive first), each with its role badge, survivor
 * status and current-week pick, plus a quick link to create a new league.
 */
export function MyLeaguesDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<EnrolledLeague[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => (user ? getUserEnrolledLeaguesInDb(user.id) : []))
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
  const activeLeagues = leagues.filter(
    (league) => league.leagueStatus === "active",
  );
  const counter = activeLeagues.length;

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
              {counter > 0
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
                <Link
                  href="/create-league"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear una liga
                </Link>
              </div>
            ) : (
              <ul className="p-1.5 space-y-0.5">
                {leagues.map((league) => (
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
                        <span className="flex items-center gap-2">
                          {league.isCommissioner ? (
                            <Badge
                              variant="warning"
                              className="text-[10px] px-1.5 py-0"
                            >
                              <Crown className="w-2.5 h-2.5" />
                              Comisionado
                            </Badge>
                          ) : (
                            <Badge
                              variant="info"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Jugador
                            </Badge>
                          )}
                          {league.isAlive ? (
                            <Badge
                              variant="success"
                              className="text-[10px] px-1.5 py-0"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-success" />
                              Vivo
                            </Badge>
                          ) : (
                            <Badge
                              variant="danger"
                              className="text-[10px] px-1.5 py-0"
                            >
                              <X className="w-2.5 h-2.5" />
                              Eliminado
                            </Badge>
                          )}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {pickLabel(league.currentWeekPick)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
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
