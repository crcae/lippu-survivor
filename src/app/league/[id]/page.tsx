"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Shield, Star } from "lucide-react";
import Link from "next/link";

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
  entryName: "Matias - Pick #1",
  totalEntries: 10,
  remainingEntries: 7,
  strikes: 0,
  strikesMax: 1,
  prizePool: 2400,
};

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

  const [now, setNow] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(ACTIVE_WEEK);
  const { picks, getPickForWeek, confirmPick } = useSurvivorPicks(
    leagueId,
    SEED_PICKS,
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

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-md bg-background/80">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors focus-ring rounded-lg px-2 py-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Inicio
            </Link>
            <span className="w-px h-6 bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline text-sm font-bold text-text-primary">
                Lippu <span className="text-primary">Survivor</span>
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 border border-border text-xs font-medium text-accent">
            <Star className="w-3 h-3" />
            Liga {leagueId} · {SEASON_YEAR}
          </span>
        </nav>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <LeagueHeader
          leagueName={MOCK_LEAGUE.name}
          status="alive"
          entryName={MOCK_LEAGUE.entryName}
          remainingEntries={MOCK_LEAGUE.remainingEntries}
          totalEntries={MOCK_LEAGUE.totalEntries}
          strikes={MOCK_LEAGUE.strikes}
          strikesMax={MOCK_LEAGUE.strikesMax}
          prizePool={MOCK_LEAGUE.prizePool}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />

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

        <LeaderboardTable
          participants={MOCK_PARTICIPANTS}
          highlightEntryId="u-matias"
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-surface/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
          <span>© {SEASON_YEAR} Lippu Survivor. Todos los derechos reservados.</span>
          <span className="text-xs text-border">survivor.lippu.app</span>
        </div>
      </footer>

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
        onClose={() => setIsRulesOpen(false)}
      />

      <PickHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        picks={picks}
        currentWeek={currentWeek}
      />
    </div>
  );
}
