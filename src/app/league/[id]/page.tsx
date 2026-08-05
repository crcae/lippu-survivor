"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles } from "lucide-react";

import { useToast } from "@/components/ui";
import {
  MobileNav,
  type MobileNavTab,
} from "@/components/layout/MobileNav";
import {
  CurrentPickBadge,
  LeagueHeader,
  LeagueRulesModal,
  LeaderboardTable,
  PickConfirmationModal,
  PickHistoryDrawer,
  TeamPickerGrid,
  WeekSelector,
} from "@/components/survivor";
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
import type { NFLGame, NFLTeam, NFLTeamId, WeekPicks } from "@/types";

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

export default function LeaguePage() {
  const params = useParams<{ id: string }>();
  const leagueId = params.id;
  const isDemo = leagueId === "demo";

  const { success } = useToast();

  const [now, setNow] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(ACTIVE_WEEK);
  const [activeEntryId, setActiveEntryId] = useState<string>(MOCK_ENTRIES[0].id);
  const { picks, getPickForWeek, confirmPick } = useSurvivorPicks(
    leagueId,
    activeEntryId === MOCK_ENTRIES[0].id ? SEED_PICKS : undefined,
    activeEntryId,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<NFLTeamId | null>(null);

  const [games, setGames] = useState<NFLGame[]>([]);
  const [gamesSource, setGamesSource] = useState<SurvivorDataSource>("mock");
  const [gamesLoading, setGamesLoading] = useState(true);

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

  // Load games for the active week (ESPN → mock fallback).
  useEffect(() => {
    let cancelled = false;

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
  }, [currentWeek]);

  // Poll while any game is live.
  useEffect(() => {
    const hasLiveGames = games.some((game) => game.status === "in_progress");
    if (!hasLiveGames) return;

    const id = setInterval(() => {
      getNflGames(currentWeek, SEASON_YEAR)
        .then((result) => {
          setGames(result.games);
          setGamesSource(result.source);
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [games, currentWeek]);

  const completedWeeks = useMemo(
    () => new Set(WEEK_NUMBERS.filter((week) => week < currentWeek)),
    [currentWeek],
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

  const isPickConfirmed = selectedTeamId === null && confirmedPickId !== null;

  const pendingPick: { team: NFLTeam; game: NFLGame } | null =
    pendingPickTeamId !== null && gameByTeam[pendingPickTeamId] !== undefined
      ? { team: getTeam(pendingPickTeamId), game: gameByTeam[pendingPickTeamId] }
      : null;

  const handleWeekChange = (week: number) => {
    setGamesLoading(true);
    setGames([]);
    setCurrentWeek(week);
    setSelectedTeamId(getPickForWeek(week));
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

  const handleConfirmPick = () => {
    if (pendingPickTeamId === null) return;
    confirmPick(currentWeek, pendingPickTeamId);
    success("¡Pick confirmado para la semana " + currentWeek + "!");
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
    now !== null && !(gamesLoading && games.length === 0);

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
        <LeagueHeader
          leagueName={MOCK_LEAGUE.name}
          status="alive"
          entries={MOCK_ENTRIES}
          activeEntryId={activeEntryId}
          onEntryChange={setActiveEntryId}
          remainingEntries={MOCK_LEAGUE.remainingEntries}
          totalEntries={MOCK_LEAGUE.totalEntries}
          strikes={MOCK_LEAGUE.strikes}
          strikesMax={MOCK_LEAGUE.strikesMax}
          prizePool={MOCK_LEAGUE.prizePool}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />

        <div ref={pickSectionRef} className="scroll-mt-24 space-y-8">
          <WeekSelector
            weeks={WEEK_NUMBERS}
            currentWeek={currentWeek}
            completedWeeks={completedWeeks}
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
            participants={MOCK_PARTICIPANTS}
            highlightEntryId="u-matias"
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
      />
    </div>
  );
}
