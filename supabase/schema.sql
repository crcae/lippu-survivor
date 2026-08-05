-- ============================================================================
-- Lippu Survivor 2026 — Supabase / PostgreSQL Schema
-- survivor.lippu.app
--
-- Run this file in the Supabase SQL editor. It is idempotent-friendly for
-- fresh databases. Includes enums, tables, indexes, RLS policies and the
-- automatic `updated_at` trigger used across all mutable tables.
-- ============================================================================

-- ── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Custom ENUMs ───────────────────────────────────────────────────────────

-- Lifecycle of a league.
create type league_status as enum (
  'draft',
  'active',
  'completed',
  'archived'
);

-- Lifecycle of a user's entry inside a league.
create type entry_status as enum (
  'alive',
  'eliminated',
  'winner'
);

-- Result of a weekly pick.
create type pick_result as enum (
  'pending',
  'win',
  'loss',
  'push'
);

-- Status of an NFL game.
create type game_status as enum (
  'scheduled',
  'in_progress',
  'final',
  'postponed'
);

-- ── Updated-at trigger (shared) ────────────────────────────────────────────

-- Generic trigger function that stamps `updated_at = now()` before updates.
create or replace function set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function set_updated_at();

-- ── Leagues ────────────────────────────────────────────────────────────────

create table public.leagues (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  description           text,
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  season_year           integer not null default 2026,
  max_entries_per_user  integer not null default 1 check (max_entries_per_user between 1 and 5),
  max_capacity          integer, -- NULL = unlimited
  strikes_allowed       integer not null default 0 check (strikes_allowed between 0 and 1),
  entry_fee             numeric(10, 2) not null default 0,
  invite_code           text not null unique,
  status                league_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_leagues_owner_id on public.leagues (owner_id);
create index idx_leagues_status on public.leagues (status);
create index idx_leagues_invite_code on public.leagues (invite_code);

create trigger trg_leagues_updated_at
  before update on public.leagues
  for each row execute function set_updated_at();

-- ── Entries ────────────────────────────────────────────────────────────────

create table public.entries (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  league_id       uuid not null references public.leagues (id) on delete cascade,
  entry_name      text not null,
  status          entry_status not null default 'alive',
  eliminated_week integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (league_id, entry_name)
);

create index idx_entries_user_id on public.entries (user_id);
create index idx_entries_league_id on public.entries (league_id);
create index idx_entries_status on public.entries (status);

create trigger trg_entries_updated_at
  before update on public.entries
  for each row execute function set_updated_at();

-- ── Picks ──────────────────────────────────────────────────────────────────

create table public.picks (
  id         uuid primary key default uuid_generate_v4(),
  entry_id   uuid not null references public.entries (id) on delete cascade,
  week       integer not null check (week between 1 and 18),
  team_id    text not null, -- NFL team abbreviation, e.g. 'KC'
  result     pick_result not null default 'pending',
  locked_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, week)
);

create index idx_picks_entry_id on public.picks (entry_id);
create index idx_picks_week on public.picks (week);
create index idx_picks_team_id on public.picks (team_id);

create trigger trg_picks_updated_at
  before update on public.picks
  for each row execute function set_updated_at();

-- ── NFL Games ──────────────────────────────────────────────────────────────

create table public.nfl_games (
  id            text primary key, -- ESPN event id, e.g. '401772940'
  week          integer not null check (week between 1 and 18),
  season_year   integer not null default 2026,
  home_team_id  text not null,
  away_team_id  text not null,
  home_score    integer,
  away_score    integer,
  status        game_status not null default 'scheduled',
  start_time    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (week, season_year, home_team_id, away_team_id)
);

create index idx_nfl_games_week on public.nfl_games (week);
create index idx_nfl_games_season on public.nfl_games (season_year);
create index idx_nfl_games_status on public.nfl_games (status);

create trigger trg_nfl_games_updated_at
  before update on public.nfl_games
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.leagues  enable row level security;
alter table public.entries  enable row level security;
alter table public.picks    enable row level security;
alter table public.nfl_games enable row level security;

-- ── Profiles ──
-- Everyone can read profiles (to show names/avatars in leaderboards).
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

-- A user can only edit their own profile.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── Leagues ──
-- Public leagues are readable by everyone.
create policy "Active and completed leagues are readable"
  on public.leagues for select
  using (status in ('active', 'completed'));

-- Owners manage their own leagues.
create policy "Owners can insert leagues"
  on public.leagues for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update their own leagues"
  on public.leagues for update
  using (auth.uid() = owner_id);

create policy "Owners can delete their own leagues"
  on public.leagues for delete
  using (auth.uid() = owner_id);

-- ── Entries ──
-- Users can see entries of leagues they are part of or own.
create policy "Entries are readable by members"
  on public.entries for select
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id
        and (l.owner_id = auth.uid() or l.id in (
          select league_id from public.entries e where e.user_id = auth.uid()
        ))
    )
  );

-- Users can register their own entries.
create policy "Users can insert their own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

-- League owners can update entry status (eliminations, winners).
create policy "League owners can update entries"
  on public.entries for update
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.owner_id = auth.uid()
    )
  );

-- ── Picks ──
-- A user can read picks for entries they own in leagues they belong to.
create policy "Users can read their own picks"
  on public.picks for select
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- A user can submit picks for their own entries.
create policy "Users can insert their own picks"
  on public.picks for insert
  with check (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

create policy "Users can update their own picks"
  on public.picks for update
  using (
    exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- ── NFL Games ──
-- Public read-only schedule/score data used by the whole app.
create policy "NFL games are publicly readable"
  on public.nfl_games for select
  using (true);

-- ============================================================================
-- Helper views
-- ============================================================================

-- Leaderboard: aggregate alive entries per league with strike counts.
create or replace view public.league_leaderboard as
select
  e.league_id,
  e.user_id,
  e.id as entry_id,
  e.entry_name,
  e.status,
  count(p.id) filter (where p.result = 'loss') as strikes,
  count(p.id) filter (where p.result = 'win') as wins
from public.entries e
left join public.picks p on p.entry_id = e.id
group by e.league_id, e.user_id, e.id, e.entry_name, e.status;

-- ============================================================================
-- Sample seed (optional, commented out)
-- ============================================================================
-- insert into public.leagues
--   (name, owner_id, season_year, max_entries_per_user, max_capacity,
--    strikes_allowed, entry_fee, invite_code, status)
-- values
--   ('Survivor NFL Lippu 2026', <owner_id>, 2026, 2, 10, 1, 50, 'LIP8XC', 'active');
