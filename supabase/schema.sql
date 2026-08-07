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

-- Lifecycle of a Lippu ticket token (purchased on Lippu.app, redeemed in-app).
create type ticket_status as enum (
  'available',
  'redeemed',
  'expired'
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
  capacity              integer, -- NULL = unlimited
  strikes_allowed       integer not null default 0 check (strikes_allowed between 0 and 1),
  entry_fee             numeric(10, 2) not null default 0,
  platform_fee_percent  numeric(5, 2) not null default 8.00,
  is_public             boolean not null default true,
  league_type           text not null default 'free' check (league_type in ('paid', 'free')),
  invite_code           text not null unique,
  status                league_status not null default 'draft',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Phase 1 monetization columns (idempotent for databases created before
-- they existed).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues'
      and column_name = 'platform_fee_percent'
  ) then
    alter table public.leagues
      add column platform_fee_percent numeric(5, 2) not null default 8.00;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues'
      and column_name = 'is_public'
  ) then
    alter table public.leagues
      add column is_public boolean not null default true;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues'
      and column_name = 'league_type'
  ) then
    alter table public.leagues
      add column league_type text not null default 'free'
      check (league_type in ('paid', 'free'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues'
      and column_name = 'bolsa_total'
  ) then
    alter table public.leagues
      add column bolsa_total numeric(10, 2) not null default 0;
  end if;
end
$$;

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
  strikes         integer not null default 0 check (strikes >= 0),
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

-- ── Ticket Tokens (Lippu.app integration) ───────────────────────────────────
-- A token is minted by the Lippu (Bubble.io) backend when a user purchases
-- one or more entries, and redeemed in-app to grant the buyer's entries.
-- `code` is the public redemption code shown to the buyer (e.g. LIPPU-TK-XXXX).

create table public.ticket_tokens (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique,
  league_id     uuid not null references public.leagues (id) on delete cascade,
  entries_count integer not null default 1 check (entries_count between 1 and 20),
  user_email    text,
  status        ticket_status not null default 'available',
  redeemed_at   timestamptz,
  redeemed_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_ticket_tokens_code on public.ticket_tokens (code);
create index idx_ticket_tokens_league on public.ticket_tokens (league_id);
create index idx_ticket_tokens_status on public.ticket_tokens (status);

create trigger trg_ticket_tokens_updated_at
  before update on public.ticket_tokens
  for each row execute function set_updated_at();

-- ── Payments (Kushki) ───────────────────────────────────────────────────────
-- One row per Kushki charge attempt for a paid league entry. Rows are inserted
-- by the server-side charge route (`/api/payments/kushki/charge`) with the
-- service-role client, so no public insert policy is required.

create table public.payments (
  id                   uuid primary key default uuid_generate_v4(),
  league_id            uuid not null references public.leagues (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  entry_id             uuid references public.entries (id) on delete set null,
  ticket_amount        numeric(10, 2) not null default 0,
  platform_fee_amount  numeric(10, 2) not null default 0,
  total_paid           numeric(10, 2) not null default 0,
  currency             text not null default 'MXN',
  kushki_ticket_number text,
  status               text not null default 'approved' check (status in ('approved', 'declined', 'completed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_payments_league_id on public.payments (league_id);
create index idx_payments_user_id on public.payments (user_id);
create index idx_payments_status on public.payments (status);

create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function set_updated_at();

-- ── League Participants ─────────────────────────────────────────────────────
-- Explicit participant mirror used by the payment flow to reconcile who paid.
-- The canonical participant record is `entries` (drives entry counts, the
-- prize pool and eliminations everywhere in the app); this table exists so
-- databases can model paid participants directly. Writes from
-- `/api/payments/kushki/charge` are best-effort and safe on databases that
-- omit this table.

create table public.league_participants (
  id         uuid primary key default uuid_generate_v4(),
  league_id  uuid not null references public.leagues (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  status     text not null default 'active',
  joined_at  timestamptz not null default now(),
  unique (league_id, user_id)
);

create index idx_league_participants_league on public.league_participants (league_id);
create index idx_league_participants_user on public.league_participants (user_id);

-- ── Commissioner Payout Details ─────────────────────────────────────────────
-- Bank information the league commissioner saves so Lippu can liquidate the
-- prize pool. Keyed 1:1 to the league. Writes happen server-side through
-- `/api/payments/payout-details` (admin client + owner check); RLS below keeps
-- the data away from direct client reads except by the authenticated owner.

create table public.commissioner_payout_details (
  id              uuid primary key default uuid_generate_v4(),
  league_id       uuid not null unique references public.leagues (id) on delete cascade,
  bank_name       text,
  clabe           text,
  account_holder  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_payout_details_league on public.commissioner_payout_details (league_id);

create trigger trg_commissioner_payout_details_updated_at
  before update on public.commissioner_payout_details
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.leagues  enable row level security;
alter table public.entries  enable row level security;
alter table public.picks    enable row level security;
alter table public.nfl_games enable row level security;
alter table public.ticket_tokens enable row level security;
alter table public.payments enable row level security;
alter table public.commissioner_payout_details enable row level security;

-- ── Profiles ──
-- Everyone can read profiles (to show names/avatars in leaderboards).
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

-- A user can only edit their own profile.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- A user can create their own profile row on first sign-in.
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Local guest fallback: when anonymous auth sign-ins are disabled the app
-- persists a deterministic device guest id directly. Allow anon inserts so
-- league creation never fails. Read/update stay restricted above.
create policy "Anon guests can insert profiles"
  on public.profiles for insert
  with check (auth.uid() is null);

-- ── Leagues ──
-- Public (active/completed) leagues are readable by everyone, and owners or
-- members can always read their own leagues (including drafts).
create policy "Leagues are readable by members and owners"
  on public.leagues for select
  using (
    status in ('active', 'completed')
    or owner_id = auth.uid()
    or auth.uid() in (
      select user_id from public.entries where league_id = id
    )
  );

-- Owners manage their own leagues.
create policy "Owners can insert leagues"
  on public.leagues for insert
  with check (auth.uid() = owner_id);

-- Local guest fallback: allow anon guests to create leagues so creation never
-- fails when anonymous auth sign-ins are disabled.
create policy "Anon guests can insert leagues"
  on public.leagues for insert
  with check (auth.uid() is null and owner_id is not null);

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

-- Local guest fallback: allow anon guests to register entries (self-join and
-- the owner's first entry on league creation).
create policy "Anon guests can insert entries"
  on public.entries for insert
  with check (auth.uid() is null and user_id is not null and league_id is not null);

-- Local guest fallback: anon guests need to read their own entries to hydrate
-- the dashboard (active entry, entry name). Entries data is already exposed
-- publicly through the `league_leaderboard` view, so this stays consistent.
create policy "Anon guests can read entries"
  on public.entries for select
  using (auth.uid() is null);

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
-- League owners and members can read picks for the league, which powers the
-- leaderboard pick history. Covers the user's own picks too.
create policy "League members can read picks"
  on public.picks for select
  using (
    exists (
      select 1 from public.entries e
      join public.leagues l on l.id = e.league_id
      where e.id = entry_id
        and (
          l.owner_id = auth.uid()
          or auth.uid() in (
            select user_id from public.entries where league_id = l.id
          )
        )
    )
  );

-- Local guest fallback: anon guests read picks (pick history / re-hydration).
-- Scoped to entries that exist, consistent with the leaderboard view.
create policy "Anon guests can read picks"
  on public.picks for select
  using (
    auth.uid() is null
    and exists (
      select 1 from public.league_leaderboard lb where lb.entry_id = entry_id
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

-- Local guest fallback: allow anon guests to submit picks for existing entries
-- so the survivor game keeps working without an auth session. The entry check
-- uses the leaderboard view, which runs with owner privileges and is readable
-- by everyone (anon guests cannot read the raw entries table under RLS).
create policy "Anon guests can insert picks"
  on public.picks for insert
  with check (
    auth.uid() is null
    and exists (
      select 1 from public.league_leaderboard lb where lb.entry_id = entry_id
    )
  );

-- Local guest fallback: changing a selection before kickoff upserts the same
-- (entry_id, week) row, which needs UPDATE privileges. Scoped to existing
-- entries (via the leaderboard view), consistent with the insert policy.
create policy "Anon guests can update picks"
  on public.picks for update
  using (
    auth.uid() is null
    and exists (
      select 1 from public.league_leaderboard lb where lb.entry_id = entry_id
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

-- ── Ticket Tokens ──
-- Lippu (Bubble.io) mints tokens via the anon key; users read + redeem them.
-- NOTE: In production, gate minting behind the service role key or a shared
-- secret; the public insert policy below is a pragmatic starter for the
-- Bubble integration.

create policy "Lippu can mint ticket tokens"
  on public.ticket_tokens for insert
  with check (true);

create policy "Anyone can read ticket tokens"
  on public.ticket_tokens for select
  using (true);

create policy "Anyone can update ticket tokens"
  on public.ticket_tokens for update
  using (true)
  with check (true);

-- ── Payments ──
-- Users can read their own payments (payment history). Inserts happen through
-- the server-side charge route using the service-role key, which bypasses RLS.

create policy "Users can read their own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- ── Commissioner Payout Details ──
-- Only the league owner can read/write payout details directly. The in-app
-- save flow goes through the server route (admin client + owner check), which
-- also supports guest commissioners whose UUID is the league `owner_id`.

create policy "Owners can read payout details"
  on public.commissioner_payout_details for select
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.owner_id = auth.uid()
    )
  );

create policy "Owners can insert payout details"
  on public.commissioner_payout_details for insert
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.owner_id = auth.uid()
    )
  );

create policy "Owners can update payout details"
  on public.commissioner_payout_details for update
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.owner_id = auth.uid()
    )
  );

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
  e.strikes,
  count(p.id) filter (where p.result = 'win') as wins
from public.entries e
left join public.picks p on p.entry_id = e.id
group by e.league_id, e.user_id, e.id, e.entry_name, e.status, e.strikes;

-- ============================================================================
-- Sample seed (optional, commented out)
-- ============================================================================
-- insert into public.leagues
--   (name, owner_id, season_year, max_entries_per_user, capacity,
--    strikes_allowed, entry_fee, invite_code, status)
-- values
--   ('Survivor NFL Lippu 2026', <owner_id>, 2026, 2, 10, 1, 50, 'LIP8XC', 'active');
