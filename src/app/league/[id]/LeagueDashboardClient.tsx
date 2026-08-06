"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SearchX, Sparkles } from "lucide-react";

import { useToast } from "@/components/ui";
import {
  MobileNav,
  type MobileNavTab,
} from "@/components/layout/MobileNav";
import {
  CommissionerPanel,
  CurrentPickBadge,
  LeagueHeader,
  LeagueRulesModal,
  LeaderboardTable,
  PickConfirmationModal,
  PickHistoryDrawer,
  TeamPickerGrid,
  WeekSelector,
} from "@/components/survivor";
import type { LeagueEntryOption } from "@/components/survivor/EntrySwitcher";
import type { SurvivorDataSource } from "@/components/survivor/TeamPickerGrid";
import { useSurvivorPicks } from "@/hooks/useSurvivorPicks";
import { buildMockGames, getNflGames } from "@/lib/espn";
import {
  ACTIVE_WEEK,
  MOCK_PARTICIPANTS,
  SEASON_YEAR,
  WEEK_NUMBERS,
  getTeam,
} from "@/lib/mock-survivor-data";
import {
  getCurrentUser,
  getLeagueDashboardData,
  getNflGamesInDb,
  submitPickInDb,
  type CurrentUser,
  type LeagueEntry,
} from "@/lib/services/survivor-db";
import type {
  League,
  LeaderboardParticipant,
  NFLGame,
  NFLTeam,
  NFLTeamId,
  SurvivorStatus,
  WeekPicks,
} from "@/types";

const MOCK_LEAGUE = {
  name: "Survivor NFL Lippu 2026",
  totalEntries: 10,
  remainingEntries: 7,
  strikes: 0,
  strikesMax: 1,
  prizePool: 2400,
};

const MOCK_ENTRIES = [
  { id: "entry-1", name: "Entrada #1 · Matías" },
  { id: "entry-2", name: "Entrada #2 · Matías" },
];

const SEED_PICKS: WeekPicks = {
  1: "KC",
  2: "BUF",
  3: "SF",
  4: "PHI",
  5: "BAL",
};

const POLL_INTERVAL_MS = 30_000;

interface LeagueDashboardProps {
  leagueId: string;
}

export function LeagueDashboard({ leagueId }: LeagueDashboardProps) {
  const isDemo = leagueId === "demo";

  const { success, error: toastError } = useToast();

  const [now, setNow] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(
    isDemo ? ACTIVE_WEEK : 1,
  );
  const [activeEntryId, setActiveEntryId] = useState<string>(
    isDemo ? MOCK_ENTRIES[0].id : "",
  );
  const [selectedTeamId, setSelectedTeamId] = useState<NFLTeamId | null>(null);
  const [isPickConfirmed, setIsPickConfirmed] = useState(false);

  const [games, setGames] = useState<NFLGame[]>([]);
  const [gamesSource, setGamesSource] = useState<SurvivorDataSource>("mock");
  const [gamesLoading, setGamesLoading] = useState(true);

  // DB-backed league state (only for real leagues, not `/league/demo`).
  const [dbLoadState, setDbLoadState] = useState<
    "idle" | "loading" | "ready" | "none"
  >(isDemo ? "idle" : "loading");
  const [dbLeague, setDbLeague] = useState<League | null>(null);
  const [dbUserEntries, setDbUserEntries] = useState<LeagueEntry[]>([]);
  const [dbLeaderboard, setDbLeaderboard] = useState<LeaderboardParticipant[]>(
    [],
  );
  const [dbPicksByEntry, setDbPicksByEntry] = useState<Record<string, WeekPicks>>(
    {},
  );
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isPickModalOpen, setIsPickModalOpen] = useState(false);
  const [pendingPickTeamId, setPendingPickTeamId] = useState<NFLTeamId | null>(
    null,
  );
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<MobileNavTab>("pick");

  const pickSectionRef = useRef<HTMLDivElement>(null);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  // Hydration-safe clock (skeleton until mounted).
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setNow(Date.now());
    };
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  // Load games for the active week. Demo uses the ESPN API (with mock
  // fallback); real leagues read straight from `public.nfl_games` — never mock.
  useEffect(() => {
    let cancelled = false;

    if (isDemo) {
      getNflGames(currentWeek, SEASON_YEAR)
        .then((result) => {
          if (cancelled) return;
          setGames(result.games);
          setGamesSource(result.source);
        })
        .catch(() => {
          if (cancelled) return;
          setGames(buildMockGames(currentWeek, SEASON_YEAR));
          setGamesSource("mock");
        })
        .finally(() => {
          if (!cancelled) setGamesLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // Real league: read from Supabase. The server-side sync (scoreboard route)
    // is fired best-effort so `nfl_games` stays fresh, then we re-read the DB.
    // Week 18 is protected: it is read straight from `public.nfl_games` and
    // never triggers an ESPN sync that could overwrite the curated slate.
    getNflGamesInDb(currentWeek, SEASON_YEAR)
      .then((dbGames) => {
        if (cancelled) return;
        setGames(dbGames);
        setGamesSource("db");
      })
      .catch(() => {
        if (cancelled) return;
        setGames([]);
        setGamesSource("db");
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false);
      });

    if (currentWeek !== 18) {
      fetch(
        `/api/nfl/scoreboard?week=${currentWeek}&year=${SEASON_YEAR}`,
        { cache: "no-store" },
      )
        .catch(() => null)
        .then(() => getNflGamesInDb(currentWeek, SEASON_YEAR))
        .then((dbGames) => {
          if (cancelled) return;
          setGames(dbGames);
          setGamesSource("db");
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [isDemo, currentWeek]);

  // Poll while any game is live: refresh from the DB (real) or ESPN (demo).
  useEffect(() => {
    const hasLiveGames = games.some((game) => game.status === "in_progress");
    if (!hasLiveGames) return;

    const id = setInterval(() => {
      if (isDemo) {
        getNflGames(currentWeek, SEASON_YEAR)
          .then((result) => {
            setGames(result.games);
            setGamesSource(result.source);
          })
          .catch(() => {});
        return;
      }

      // Trigger the server-side ESPN sync (updates nfl_games + evaluates picks)
      // then re-read the DB — the displayed games always come from Supabase.
      // Week 18 is protected and never re-synced from ESPN.
      if (currentWeek === 18) {
        getNflGamesInDb(currentWeek, SEASON_YEAR)
          .then((dbGames) => {
            setGames(dbGames);
            setGamesSource("db");
          })
          .catch(() => {});
        return;
      }
      fetch(
        `/api/nfl/scoreboard?week=${currentWeek}&year=${SEASON_YEAR}`,
        { cache: "no-store" },
      )
        .catch(() => null)
        .then(() => getNflGamesInDb(currentWeek, SEASON_YEAR))
        .then((dbGames) => {
          setGames(dbGames);
          setGamesSource("db");
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [games, currentWeek, isDemo]);

  // Load real league data from Supabase (skipped for `/league/demo`).
  // Re-runs when the active week changes to also refresh the week's games and
  // leaderboard, but only performs the full state reset on the first load.
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (isDemo) {
      const idle = setTimeout(() => {
        setDbLoadState("idle");
        setDbLeague(null);
      }, 0);
      return () => clearTimeout(idle);
    }

    let cancelled = false;
    const reset = setTimeout(() => {
      if (!loadedOnceRef.current) {
        setDbLoadState("loading");
        setDbLeague(null);
        setDbUserEntries([]);
        setDbLeaderboard([]);
        setDbPicksByEntry({});
        setCurrentUser(null);
      }
    }, 0);

    // Resolve the current identity (auth session or local guest UUID) so the
    // dashboard can tell whether the viewer is the league owner.
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        if (!cancelled) setCurrentUser(null);
      });

    getLeagueDashboardData(leagueId, currentWeek)
      .then((data) => {
        if (cancelled) return;
        if (data.league) {
          loadedOnceRef.current = true;
          setDbLeague(data.league);
          setDbUserEntries(data.userEntries);
          setDbLeaderboard(data.leaderboard);
          setDbPicksByEntry(data.picksByEntry);
          setGames(data.games);
          setGamesSource("db");
          setDbLoadState("ready");
          if (data.userEntries.length > 0) {
            // Keep the user's active entry across week switches.
            setActiveEntryId((prev) => prev || data.userEntries[0].id);
          }
        } else {
          setDbLoadState("none");
        }
      })
      .catch(() => {
        if (!cancelled) setDbLoadState("none");
      });

    return () => {
      cancelled = true;
      clearTimeout(reset);
    };
  }, [isDemo, leagueId, currentWeek]);

  const activeSeasonWeek = ACTIVE_WEEK;

  const completedWeeks = useMemo(
    () => new Set(WEEK_NUMBERS.filter((week) => week < activeSeasonWeek)),
    [activeSeasonWeek],
  );

  // ── Hybrid data: real league (Supabase) vs demo (mock + localStorage) ──
  const isReal = !isDemo && dbLeague !== null;

  // The current viewer is the commissioner when they own the league.
  const isOwner =
    isReal &&
    dbLeague !== null &&
    currentUser !== null &&
    currentUser.id === dbLeague.ownerId;

  const headerEntries: LeagueEntryOption[] = isReal
    ? dbUserEntries.map((entry) => ({ id: entry.id, name: entry.entryName }))
    : MOCK_ENTRIES;

  const activeDbEntry = isReal
    ? dbUserEntries.find((entry) => entry.id === activeEntryId) ?? null
    : null;

  const headerStatus: SurvivorStatus = isReal
    ? activeDbEntry
      ? activeDbEntry.status === "alive"
        ? "alive"
        : "eliminated"
      : "alive"
    : "alive";

  const totalEntries = isReal ? dbLeaderboard.length : MOCK_LEAGUE.totalEntries;
  const remainingEntries = isReal
    ? dbLeaderboard.filter((entry) => entry.status === "alive").length
    : MOCK_LEAGUE.remainingEntries;
  const strikes = activeDbEntry?.strikes ?? MOCK_LEAGUE.strikes;
  const strikesMax = dbLeague?.strikesAllowed ?? MOCK_LEAGUE.strikesMax;
  const prizePool =
    isReal && dbLeague
      ? Math.round((dbLeague.entryFee ?? 0) * dbLeaderboard.length)
      : MOCK_LEAGUE.prizePool;

  const picksSeed = useMemo<WeekPicks | undefined>(() => {
    if (isDemo) {
      return activeEntryId === MOCK_ENTRIES[0].id ? SEED_PICKS : undefined;
    }
    return dbPicksByEntry[activeEntryId];
  }, [isDemo, activeEntryId, dbPicksByEntry]);

  const { picks, getPickForWeek, confirmPick } = useSurvivorPicks(
    leagueId,
    picksSeed,
    activeEntryId,
    { persist: !isReal },
  );

  const usedTeamWeeks = useMemo(() => {
    const map = {} as Record<NFLTeamId, number>;
    for (const [week, teamId] of Object.entries(picks)) {
      if (Number(week) !== currentWeek) {
        map[teamId] = Number(week);
      }
    }
    return map;
  }, [picks, currentWeek]);

  const gameByTeam = useMemo(() => {
    const map = {} as Record<NFLTeamId, NFLGame>;
    for (const game of games) {
      map[game.homeTeamId] = game;
      map[game.awayTeamId] = game;
    }
    return map;
  }, [games]);

  const confirmedPickId: NFLTeamId | null = getPickForWeek(currentWeek);

  const pickTeamId: NFLTeamId | null =
    selectedTeamId ?? confirmedPickId ?? null;

  const pick =
    pickTeamId !== null && gameByTeam[pickTeamId] !== undefined
      ? { teamId: pickTeamId, game: gameByTeam[pickTeamId] }
      : null;

  const pendingPick: { team: NFLTeam; game: NFLGame } | null =
    pendingPickTeamId !== null && gameByTeam[pendingPickTeamId] !== undefined
      ? { team: getTeam(pendingPickTeamId), game: gameByTeam[pendingPickTeamId] }
      : null;

  // Keep the pick UI in sync with the saved picks whenever the active week,
  // entry or DB picks change. A confirmed pick must stay confirmed (never
  // reverting to "sin confirmar") after navigating away and back to a week.
  useEffect(() => {
    const sync = setTimeout(() => {
      const existingPick = isReal
        ? dbPicksByEntry[activeEntryId]?.[currentWeek] ?? null
        : getPickForWeek(currentWeek);

      if (existingPick !== null) {
        setSelectedTeamId(existingPick);
        setIsPickConfirmed(true);
      } else {
        setSelectedTeamId(null);
        setIsPickConfirmed(false);
      }
    }, 0);
    return () => clearTimeout(sync);
  }, [currentWeek, activeEntryId, isReal, dbPicksByEntry, getPickForWeek]);

  const handleWeekChange = (week: number) => {
    setGamesLoading(true);
    setGames([]);
    setCurrentWeek(week);
  };

  const handleSelectTeam = (teamId: NFLTeamId) => {
    setSelectedTeamId(teamId);
    setPendingPickTeamId(teamId);
    setIsPickModalOpen(true);
  };

  const handleRequestConfirm = () => {
    if (selectedTeamId === null) return;
    setPendingPickTeamId(selectedTeamId);
    setIsPickModalOpen(true);
  };

  const handleConfirmPick = async () => {
    if (pendingPickTeamId === null) return;
    const week = currentWeek;
    const teamId = pendingPickTeamId;

    if (isReal) {
      const entryId = activeEntryId || dbUserEntries[0]?.id;
      if (!entryId) {
        toastError("No tienes una entrada activa en esta liga para realizar un pick.");
        return;
      }
      try {
        // Persist to Supabase enforcing the lock + team rules.
        await submitPickInDb(entryId, week, teamId);
      } catch (err) {
        toastError(
          err instanceof Error
            ? err.message
            : "No se pudo guardar tu pick. Intenta de nuevo.",
        );
        return;
      }
      // Reflect the new pick locally so pick history updates immediately.
      setDbPicksByEntry((prev) => ({
        ...prev,
        [entryId]: { ...(prev[entryId] ?? {}), [week]: teamId },
      }));
      if (!activeEntryId) {
        setActiveEntryId(entryId);
      }
      success(`¡Selección guardada con éxito para la Semana ${week}!`);
    } else {
      success("¡Pick confirmado para la semana " + week + "!");
    }

    confirmPick(week, teamId);
    setIsPickConfirmed(true);
    setSelectedTeamId(null);
    setPendingPickTeamId(null);
    setIsPickModalOpen(false);
  };

  const handleClosePickModal = () => {
    setIsPickModalOpen(false);
    setPendingPickTeamId(null);
    setSelectedTeamId(null);
  };

  const handleChangePick = () => {
    if (confirmedPickId === null) return;
    setSelectedTeamId(confirmedPickId);
    setPendingPickTeamId(confirmedPickId);
    setIsPickModalOpen(true);
  };

  const handleNavSelect = (tab: MobileNavTab) => {
    setActiveNavTab(tab);

    if (tab === "pick") {
      pickSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (tab === "tabla") {
      leaderboardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (tab === "historial") {
      setIsHistoryOpen(true);
    } else if (tab === "reglas") {
      setIsRulesOpen(true);
    }
  };

  const isReady =
    now !== null &&
    !(gamesLoading && games.length === 0) &&
    (isDemo || dbLoadState !== "loading");

  if (!isReady) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-border bg-surface/60 animate-pulse"
          />
        ))}
      </main>
    );
  }

  // A real (non-demo) league that isn't in Supabase → clean "not found" state,
  // never a mock dashboard with fake picks/participants.
  if (!isDemo && dbLoadState === "none") {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated border border-border mx-auto">
          <SearchX className="w-8 h-8 text-text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Liga no encontrada
          </h1>
          <p className="text-text-secondary mt-2">
            No encontramos una liga con este identificador, o el enlace es
            inválido.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/league/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover transition-all duration-200 shadow-glow"
          >
            Crear una liga
          </Link>
          <Link
            href="/league/join"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-accent/40 text-accent font-semibold hover:bg-accent/10 transition-all duration-200"
          >
            Unirse con código
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div className="relative z-10 border-b border-accent/30 bg-gradient-to-r from-primary/15 via-accent/10 to-primary/15">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </span>
            <p className="text-sm text-text-primary">
              Estás navegando en la{" "}
              <span className="font-bold text-accent">Liga de Demostración</span>.
              Tu pick y tu historial se guardan solo en este navegador.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-8 pb-28 md:pb-8 space-y-8">
        {isOwner && dbLeague && (
          <CommissionerPanel
            inviteCode={dbLeague.inviteCode}
            entryCount={dbLeaderboard.length}
            capacity={dbLeague.capacity}
            maxEntriesPerUser={dbLeague.maxEntries}
            leagueStatus={dbLeague.status}
          />
        )}

        <LeagueHeader
          leagueName={
            isReal && dbLeague ? dbLeague.name : MOCK_LEAGUE.name
          }
          status={headerStatus}
          entries={headerEntries}
          activeEntryId={activeEntryId}
          onEntryChange={setActiveEntryId}
          remainingEntries={remainingEntries}
          totalEntries={totalEntries}
          strikes={strikes}
          strikesMax={strikesMax}
          prizePool={prizePool}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />

        <div ref={pickSectionRef} className="scroll-mt-24 space-y-8">
          <WeekSelector
            weeks={WEEK_NUMBERS}
            currentWeek={currentWeek}
            completedWeeks={completedWeeks}
            picks={picks}
            onChange={handleWeekChange}
          />

          <CurrentPickBadge
            week={currentWeek}
            pick={pick}
            now={now}
            isConfirmed={isPickConfirmed}
            onConfirm={handleRequestConfirm}
            onChange={handleChangePick}
          />

          <TeamPickerGrid
            week={currentWeek}
            games={games}
            now={now}
            selectedTeamId={selectedTeamId}
            confirmedPickId={confirmedPickId}
            usedTeamWeeks={usedTeamWeeks}
            dataSource={gamesSource}
            onSelect={handleSelectTeam}
          />
        </div>

        <div ref={leaderboardRef} className="scroll-mt-24">
          <LeaderboardTable
            participants={isReal ? dbLeaderboard : MOCK_PARTICIPANTS}
            highlightEntryId={isReal ? activeEntryId : "u-matias"}
            ownerUserId={isOwner ? currentUser?.id : undefined}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-surface/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
          <span>© {SEASON_YEAR} Lippu Survivor. Todos los derechos reservados.</span>
          <span className="text-xs text-border">survivor.lippu.app</span>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <MobileNav activeTab={activeNavTab} onSelect={handleNavSelect} />

      {/* Overlays */}
      {pendingPick !== null && (
        <PickConfirmationModal
          isOpen={isPickModalOpen}
          onClose={handleClosePickModal}
          onConfirm={handleConfirmPick}
          team={pendingPick.team}
          game={pendingPick.game}
          week={currentWeek}
          now={now}
        />
      )}

      <LeagueRulesModal
        isOpen={isRulesOpen}
        onClose={() => {
          setIsRulesOpen(false);
          setActiveNavTab("pick");
        }}
      />

      <PickHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          setActiveNavTab("pick");
        }}
        picks={picks}
        currentWeek={currentWeek}
        isDemo={isDemo}
      />
    </div>
  );
}

export type { LeagueDashboardProps };
