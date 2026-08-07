"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_WEEK, SEASON_YEAR } from "@/lib/mock-survivor-data";
import type {
  EntryStatus,
  GameStatus,
  League,
  LeaderboardParticipant,
  NFLGame,
  NFLTeamId,
  PickResult,
  WeekPicks,
} from "@/types";

/** True when Supabase credentials exist, so callers never fall back to mock. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

interface SupabaseErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Logs the full Supabase error (`code`, `message`, `details`) to the console
 * and rethrows a plain `Error(error.message)` so the UI surfaces the exact
 * reason instead of a generic "no se pudo" message.
 */
function throwSupabaseError(step: string, error: SupabaseErrorLike): never {
  console.error(`[survivor-db] ${step} falló`, {
    code: error.code ?? null,
    message: error.message ?? String(error),
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
  throw new Error(error.message ?? String(error ?? "Error desconocido en Supabase."));
}

// ── Database row shapes (snake_case) ────────────────────────────────────────

interface LeagueRow {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  season_year: number;
  max_entries_per_user: number;
  capacity: number | null;
  strikes_allowed: number;
  entry_fee: number | string;
  platform_fee_percent: number | string;
  is_public: boolean;
  league_type: "paid" | "free";
  invite_code: string;
  status: League["status"];
  created_at: string;
  updated_at: string;
}

interface EntryRow {
  id: string;
  user_id: string;
  league_id: string;
  entry_name: string;
  status: EntryStatus;
  strikes: number;
  eliminated_week: number | null;
  created_at: string;
  updated_at: string;
}

interface PickRow {
  id: string;
  entry_id: string;
  week: number;
  team_id: string;
  result: PickResult;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NflGameRow {
  id: string;
  week: number;
  season_year: number;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: GameStatus;
  start_time: string;
}

interface LeaderboardRow {
  league_id: string;
  user_id: string;
  entry_id: string;
  entry_name: string;
  status: EntryStatus;
  strikes: number;
  wins: number;
}

// ── Public payload / result types ───────────────────────────────────────────

export interface CreateLeaguePayload {
  name: string;
  seasonYear: number;
  /** Defaults to `null` (unlimited) when omitted. */
  capacity?: number | null;
  /** Defaults to `100` (a generous safe limit for guest leagues) when omitted. */
  maxEntriesPerUser?: number;
  strikesAllowed: number;
  /** Defaults to `0` (free league) when omitted. */
  entryFee?: number;
  /** Defaults to `"free"` when omitted. */
  leagueType?: "paid" | "free";
  /** Defaults to `true` (appears on the landing page) when omitted. */
  isPublic?: boolean;
  /** Defaults to `8` (8% platform fee) when omitted. */
  platformFeePercent?: number;
  inviteCode: string;
}

export interface TicketTokenPayload {
  ticketCode: string;
  leagueId: string;
  entriesCount?: number;
  userEmail?: string;
}

export interface TicketRedeemResult {
  leagueId: string;
  leagueName: string;
  entryIds: string[];
  entriesCount: number;
}

export interface LeagueEntry {
  id: string;
  userId: string;
  leagueId: string;
  entryName: string;
  status: EntryStatus;
  strikes: number;
  eliminatedWeek?: number;
}

export interface LeagueLookup {
  league: League;
  entryCount: number;
  activeParticipants: number;
  ownerName?: string;
}

export interface LeagueDashboardData {
  league: League | null;
  userEntries: LeagueEntry[];
  leaderboard: LeaderboardParticipant[];
  /** Picks grouped by entry id, so multi-entry contexts stay isolated. */
  picksByEntry: Record<string, WeekPicks>;
  /** Real games for the requested week, straight from `public.nfl_games`. */
  games: NFLGame[];
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  /** True when no Supabase auth session exists (local guest fallback). */
  isGuest?: boolean;
}

// ── Mappers (snake_case → camelCase) ────────────────────────────────────────

function mapLeague(row: LeagueRow): League {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerId: row.owner_id,
    seasonYear: row.season_year,
    status: row.status,
    maxEntries: row.max_entries_per_user,
    inviteCode: row.invite_code,
    capacity: row.capacity ?? undefined,
    strikesAllowed: row.strikes_allowed,
    entryFee: Number(row.entry_fee),
    leagueType: row.league_type === "paid" ? "paid" : "free",
    isPublic: row.is_public ?? true,
    platformFeePercent: Number(row.platform_fee_percent ?? 8),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeagueEntry(row: EntryRow): LeagueEntry {
  return {
    id: row.id,
    userId: row.user_id,
    leagueId: row.league_id,
    entryName: row.entry_name,
    status: row.status,
    strikes: row.strikes,
    eliminatedWeek: row.eliminated_week ?? undefined,
  };
}

function mapNflGame(row: NflGameRow): NFLGame {
  const isInvalidDate = !row.start_time || Number.isNaN(new Date(row.start_time).getTime());
  let startTime = row.start_time;
  let isTbd = isInvalidDate;

  if (row.week === 18 && (isInvalidDate || row.start_time?.includes("TBD"))) {
    const janMonth = 0;
    const year = (row.season_year || SEASON_YEAR) + 1;
    startTime = new Date(Date.UTC(year, janMonth, 10, 18, 0, 0)).toISOString();
    isTbd = true;
  }

  return {
    id: row.id,
    week: row.week,
    seasonYear: row.season_year,
    homeTeamId: row.home_team_id as NFLTeamId,
    awayTeamId: row.away_team_id as NFLTeamId,
    homeScore: row.home_score ?? undefined,
    awayScore: row.away_score ?? undefined,
    status: row.status,
    startTime,
    isTbd,
  };
}

const NO_ROWS = ["00000000-0000-0000-0000-000000000000"];

// ── Identity helper ─────────────────────────────────────────────────────────

const GUEST_ID_KEY = "lippu_survivor_guest_id";

export function readLocalGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GUEST_ID_KEY);
  } catch {
    return null;
  }
}

function writeLocalGuestId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_ID_KEY, id);
  } catch {
    // Storage unavailable — the guest id lives only for this session.
  }
}

/**
 * Builds a local guest identity for the given UUID. Used both when reusing a
 * persisted device guest and when generating a brand-new one.
 */
function localGuestFrom(guestId: string): CurrentUser {
  return {
    id: guestId,
    email: `anon_${guestId.replace(/[^a-z0-9]/gi, "").slice(-12)}@lippu.app`,
    displayName: "Guest",
    isGuest: true,
  };
}

function randomUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the deterministic local guest UUID for this device, generating and
 * persisting it in localStorage (`lippu_survivor_guest_id`) on first use. Used
 * as the Supabase `profiles.id` fallback when anonymous auth sign-ins are
 * disabled, so league creation never fails.
 */
export function getLocalGuestId(): string {
  const existing = readLocalGuestId();
  if (existing) return existing;
  const id = randomUuid();
  writeLocalGuestId(id);
  return id;
}

function mapUser(user: User): CurrentUser {
  const metadata = (user.user_metadata ?? {}) as {
    display_name?: string;
  } | null;

  const isGuest = user.is_anonymous === true || !user.email;

  return {
    id: user.id,
    email: isGuest ? `anon_${user.id.replace(/-/g, "").slice(0, 12)}@lippu.app` : (user.email ?? ""),
    displayName: metadata?.display_name ?? (isGuest ? "Guest" : user.email?.split("@")[0] ?? "Jugador"),
  };
}

/**
 * Ensures a `profiles` row exists for the given user. Idempotent: relies on
 * the unique `id` PK and RLS insert policy (`auth.uid() = id`, or anon guest).
 */
async function ensureProfileRow(user: CurrentUser): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      avatar_url: null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

/**
 * Returns the current user identity, guaranteeing a Supabase `profiles` row.
 *
 * Resolution order (never throws auth errors):
 * 1. Existing Supabase session (email/password, OAuth, etc.).
 * 2. Existing local guest profile persisted in localStorage
 *    (`lippu_survivor_guest_id`) — deterministic per device.
 * 3. Best-effort anonymous sign-in; its user id becomes the persisted guest id
 *    so identity stays stable across reloads. Failing silently here is fine.
 * 4. **Fallback:** generate a fresh UUID v4, persist it to localStorage and
 *    insert directly into `profiles`. League creation therefore never fails
 *    when anonymous sign-ins are disabled.
 *
 * Returns `null` only when the Supabase env vars are missing entirely.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return null;
  }

  // 1) Existing session.
  const existing = await supabase.auth.getUser();
  if (existing.data.user) {
    const current = mapUser(existing.data.user);
    try {
      await ensureProfileRow(current);
    } catch (err) {
      console.warn("[survivor-db] No se pudo sincronizar el perfil de la sesión:", err);
    }
    return current;
  }

  // 2) Existing local guest profile (deterministic per device).
  const existingGuestId = readLocalGuestId();
  if (existingGuestId) {
    const current = localGuestFrom(existingGuestId);
    try {
      await ensureProfileRow(current);
    } catch (err) {
      console.warn("[survivor-db] No se pudo sincronizar el perfil guest existente:", err);
    }
    return current;
  }

  // 3) Best-effort anonymous sign-in (only when no local guest exists yet).
  //    Any failure here is swallowed — it must never block league creation.
  const guest = await supabase.auth.signInAnonymously();
  if (!guest.error && guest.data.user) {
    writeLocalGuestId(guest.data.user.id);
    const current = mapUser(guest.data.user);
    try {
      await ensureProfileRow(current);
    } catch (err) {
      console.warn("[survivor-db] No se pudo sincronizar el perfil anónimo:", err);
    }
    return current;
  }

  // 4) Generate and persist a local guest UUID, inserted directly into profiles.
  const guestId = getLocalGuestId();
  const localGuest = localGuestFrom(guestId);
  try {
    await ensureProfileRow(localGuest);
  } catch (err) {
    console.warn("[survivor-db] No se pudo insertar el perfil guest local:", err);
  }

  return localGuest;
}

// ── Leagues ─────────────────────────────────────────────────────────────────

/**
 * Creates a league owned by the current user. Guarantees a `profiles` row for
 * the owner (auto-created as a local guest when needed) and registers their
 * first `entries` row. Returns the new league id so the caller can redirect
 * straight to `/league/[id]`.
 *
 * Never throws auth errors for missing sessions: guests fall back to a
 * deterministic local UUID so creation always succeeds. Every Supabase step is
 * logged (`[survivor-db] ...`) and errors are rethrown with the exact
 * `message` from Supabase so the UI can display the real cause.
 */
export async function createLeagueInDb(
  payload: CreateLeaguePayload,
): Promise<{ leagueId: string }> {
  const supabase = createClient();

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Debes iniciar sesión para crear una liga.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      avatar_url: null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) throwSupabaseError("inserción del perfil", profileError);

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: payload.name,
      owner_id: user.id,
      season_year: payload.seasonYear,
      max_entries_per_user: payload.maxEntriesPerUser ?? 100,
      capacity: payload.capacity ?? null,
      strikes_allowed: payload.strikesAllowed,
      entry_fee: payload.entryFee ?? 0,
      league_type: payload.leagueType ?? "free",
      is_public: payload.isPublic ?? true,
      platform_fee_percent: payload.platformFeePercent ?? 8,
      invite_code: payload.inviteCode,
      status: "active",
    })
    .select("id")
    .single();
  if (leagueError) throwSupabaseError("inserción de la liga", leagueError);

  // Paid leagues get NO free owner entry: the commissioner must first pay the
  // entry fee (the dashboard redirects them to the checkout). Only free leagues
  // auto-register the owner's first entry here.
  if (payload.leagueType !== "paid") {
    const { error: entryError } = await supabase.from("entries").insert({
      user_id: user.id,
      league_id: league.id,
      entry_name: `Entrada 1 - ${user.displayName}`,
    });
    if (entryError) throwSupabaseError("inserción de la entrada del dueño", entryError);
  }

  return { leagueId: league.id };
}

/**
 * Looks up a league by its invite code, returning the league plus the current
 * entry count (used to validate capacity). Returns `null` when not found.
 */
export async function getLeagueByInviteCode(
  code: string,
): Promise<LeagueLookup | null> {
  const supabase = createClient();

  const { data: leagueRow, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("invite_code", code.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!leagueRow) return null;

  const { count } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueRow.id);

  const { count: activeCount } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueRow.id)
    .eq("status", "alive");

  let ownerName = "Comisionado";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", leagueRow.owner_id)
      .maybeSingle();
    if (profile) {
      ownerName = profile.display_name || profile.email?.split("@")[0] || "Comisionado";
    }
  } catch {
    // Best effort profile fetch
  }

  return {
    league: mapLeague(leagueRow),
    entryCount: count ?? 0,
    activeParticipants: activeCount ?? 0,
    ownerName,
  };
}

/**
 * Registers a new entry for the user in a league, enforcing per-user entry
 * limits, total capacity and a unique entry name.
 */
export async function joinLeagueInDb(
  leagueId: string,
  userId: string,
  entryName: string,
): Promise<{ entryId: string }> {
  const supabase = createClient();

  try {
    await ensureProfileRow({ id: userId, email: "", displayName: "Jugador" });
  } catch {
    // Best-effort profile sync; entry insert below is the source of truth.
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) throw new Error("La liga no existe.");

  // Strict payment gate — paid leagues only grant entries through the Kushki
  // charge flow (`/api/payments/kushki/charge` → `createPaidEntry`), never
  // through this free-join path.
  if (league.league_type === "paid") {
    throw new Error(
      "Esta liga es de paga: completa el pago para crear tu entrada.",
    );
  }

  const { count: userEntries, error: countError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (countError) throw countError;

  if (userEntries !== null && userEntries >= league.max_entries_per_user) {
    throw new Error("Alcanzaste el máximo de entradas permitidas en esta liga.");
  }

  const { count: totalEntries, error: totalError } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  if (totalError) throw totalError;

  if (league.capacity !== null && totalEntries !== null && totalEntries >= league.capacity) {
    throw new Error("Esta liga ya está llena.");
  }

  const baseName = entryName.trim() || "Entrada #1";
  const { data: existingNames } = await supabase
    .from("entries")
    .select("entry_name")
    .eq("league_id", leagueId);
  const names = new Set((existingNames ?? []).map((row) => row.entry_name));

  let finalName = baseName;
  let suffix = 2;
  while (names.has(finalName)) {
    finalName = `${baseName} #${suffix}`;
    suffix += 1;
  }

  const { data: entry, error: insertError } = await supabase
    .from("entries")
    .insert({
      user_id: userId,
      league_id: leagueId,
      entry_name: finalName,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  return { entryId: entry.id };
}

// ── Phase 1: Public discovery & join preview ────────────────────────────────

export interface PublicLeague {
  id: string;
  name: string;
  leagueType: "paid" | "free";
  entryFee: number;
  platformFeePercent: number;
  /** Entries still alive (active players). */
  activeParticipants: number;
  /** `entry_fee * active_entries_count`. */
  totalPot: number;
}

interface PublicLeagueRow {
  id: string;
  name: string;
  league_type: "paid" | "free";
  entry_fee: number | string;
  platform_fee_percent: number | string;
}

/**
 * Lists the public, active leagues for the landing page: `is_public = true`,
 * `status = 'active'` and current season. Active participant counts are read
 * from `entries` in a single batched query, so the total pot
 * (`entry_fee * active_entries_count`) is always live. Returns `[]` when there
 * are no public leagues (never mock data).
 */
export async function getPublicLeaguesInDb(): Promise<PublicLeague[]> {
  const supabase = createClient();

  const { data: leagueRows, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("is_public", true)
    .eq("status", "active")
    .eq("season_year", SEASON_YEAR)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!leagueRows || leagueRows.length === 0) return [];

  const ids = (leagueRows as PublicLeagueRow[]).map((row) => row.id);
  const { data: entryRows } = await supabase
    .from("entries")
    .select("league_id")
    .in("league_id", ids)
    .eq("status", "alive");

  const counts = new Map<string, number>();
  for (const entry of entryRows ?? []) {
    counts.set(entry.league_id, (counts.get(entry.league_id) ?? 0) + 1);
  }

  return (leagueRows as PublicLeagueRow[]).map((row) => {
    const activeParticipants = counts.get(row.id) ?? 0;
    const entryFee = Number(row.entry_fee ?? 0);
    return {
      id: row.id,
      name: row.name,
      leagueType: row.league_type === "paid" ? "paid" : "free",
      entryFee,
      platformFeePercent: Number(row.platform_fee_percent ?? 8),
      activeParticipants,
      totalPot: Math.round(entryFee * activeParticipants),
    };
  });
}

export interface LeaguePreview {
  league: League;
  entryCount: number;
  activeParticipants: number;
  participants: { entryName: string; status: EntryStatus }[];
  ownerName?: string;
}

/**
 * Fetches a full public preview of a league for `/join/[id]`: league details
 * (with fee/visibility/type), participant list, counts and commissioner name.
 * Returns `null` when the league does not exist.
 */
export async function getLeaguePreviewInDb(
  leagueId: string,
): Promise<LeaguePreview | null> {
  const supabase = createClient();

  const { data: leagueRow, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  if (!leagueRow) return null;

  const league = mapLeague(leagueRow as LeagueRow);

  const { data: entryRows, error: entriesError } = await supabase
    .from("entries")
    .select("entry_name, status")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });
  if (entriesError) throw entriesError;

  const participants = (entryRows ?? []).map((entry) => ({
    entryName: entry.entry_name,
    status: entry.status as EntryStatus,
  }));

  let ownerName = "Comisionado";
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", leagueRow.owner_id)
      .maybeSingle();
    if (profile) {
      ownerName =
        profile.display_name || profile.email?.split("@")[0] || "Comisionado";
    }
  } catch {
    // Best-effort profile fetch.
  }

  return {
    league,
    entryCount: participants.length,
    activeParticipants: participants.filter((p) => p.status === "alive").length,
    participants,
    ownerName,
  };
}

// ── Phase 3: Commissioner Financials ────────────────────────────────────────

interface PaymentRow {
  id: string;
  league_id: string;
  user_id: string;
  entry_id: string | null;
  ticket_amount: number | string;
  platform_fee_amount: number | string;
  total_paid: number | string;
  currency: string;
  kushki_ticket_number: string | null;
  status: "approved" | "declined" | "completed";
  created_at: string;
  updated_at: string;
}

/** Payment state per entry, computed from `payments` + league type. */
export type FinancialEntryPaymentStatus = "approved" | "pending" | "free";

/** One audit-table row: a league entry enriched with its approved payment. */
export interface FinancialEntryRecord {
  entryId: string;
  entryName: string;
  userId: string;
  playerName: string;
  playerEmail?: string;
  paymentStatus: FinancialEntryPaymentStatus;
  /** Actual charged amount when approved; expected fee when pending (paid leagues). */
  ticketAmount: number;
  platformFeeAmount: number;
  totalPaid: number;
  kushkiTicketNumber?: string;
  paidAt?: string;
  createdAt: string;
}

/** Aggregated financial snapshot for a league (approved payments only). */
export interface LeagueFinancials {
  leagueType: "paid" | "free";
  entryFee: number;
  platformFeePercent: number;
  /** `SUM(ticket_amount)` approved → 100% goes to the winner. */
  prizePool: number;
  /** `SUM(platform_fee_amount)` approved → Lippu's service fee. */
  platformFee: number;
  /** `SUM(total_paid)` approved → gross collected. */
  totalGross: number;
  /** Entries with an approved payment. */
  paidParticipants: number;
  /** Total entries in the league. */
  totalEntries: number;
  currency: string;
  entries: FinancialEntryRecord[];
}

/** Commissioner bank details for the payout. */
export interface PayoutDetails {
  bankName: string;
  clabe: string;
  accountHolder: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Loads everything the commissioner finance panel needs for a league: all
 * entries (with player names/emails) joined with their approved payments.
 *
 * Financial KPIs are computed server-side from the approved `payments` rows:
 * `prizePool` = SUM(ticket_amount), `platformFee` = SUM(platform_fee_amount),
 * `totalGross` = SUM(total_paid). `paidParticipants` counts entries that have
 * an approved payment. Returns `null` when the league does not exist.
 *
 * The returned `entries` array drives the audit table — one row per entry with
 * `paymentStatus`: "approved" (has a paid row), "pending" (paid league, no
 * payment yet) or "free" (free league). Expected amounts are shown for pending
 * rows so the commissioner sees what's still owed.
 */
export async function getLeagueFinancialsInDb(
  leagueId: string,
): Promise<LeagueFinancials | null> {
  const supabase = createClient();

  const { data: leagueRow, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!leagueRow) return null;

  const league = mapLeague(leagueRow as LeagueRow);
  const isPaid = league.leagueType === "paid";
  const entryFee = Number(league.entryFee ?? 0);
  const feePercent = Number(league.platformFeePercent ?? 8);
  const expectedFee = round2(entryFee * (feePercent / 100));
  const expectedTotal = round2(entryFee + expectedFee);

  const { data: entryRows, error: entriesError } = await supabase
    .from("entries")
    .select("id, user_id, entry_name, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });
  if (entriesError) throw entriesError;

  const userIds = [
    ...new Set((entryRows ?? []).map((entry) => entry.user_id)),
  ];
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", userIds.length ? userIds : NO_ROWS);
  const profileById = new Map(
    (profileRows ?? []).map((row) => [row.id, row]),
  );

  const { data: paymentRows, error: paymentsError } = (await supabase
    .from("payments")
    .select("*")
    .eq("league_id", leagueId)
    .in("status", ["approved", "completed"])) as {
    data: PaymentRow[] | null;
    error: Error | null;
  };
  if (paymentsError) throw paymentsError;

  const paymentByEntry = new Map<string, PaymentRow>();
  for (const payment of paymentRows ?? []) {
    if (payment.entry_id) paymentByEntry.set(payment.entry_id, payment);
  }

  let prizePool = 0;
  let platformFee = 0;
  let totalGross = 0;

  const entries: FinancialEntryRecord[] = (entryRows ?? []).map((entry) => {
    const payment = paymentByEntry.get(entry.id);
    const profile = profileById.get(entry.user_id);

    const paymentStatus: FinancialEntryPaymentStatus = !isPaid
      ? "free"
      : payment
        ? "approved"
        : "pending";

    const ticketAmount = payment
      ? Number(payment.ticket_amount)
      : isPaid
        ? entryFee
        : 0;
    const platformFeeAmount = payment
      ? Number(payment.platform_fee_amount)
      : isPaid
        ? expectedFee
        : 0;
    const totalPaid = payment
      ? Number(payment.total_paid)
      : isPaid
        ? expectedTotal
        : 0;

    if (payment) {
      prizePool += Number(payment.ticket_amount);
      platformFee += Number(payment.platform_fee_amount);
      totalGross += Number(payment.total_paid);
    }

    return {
      entryId: entry.id,
      entryName: entry.entry_name,
      userId: entry.user_id,
      playerName: profile?.display_name ?? "Jugador",
      playerEmail: profile?.email ?? undefined,
      paymentStatus,
      ticketAmount: round2(ticketAmount),
      platformFeeAmount: round2(platformFeeAmount),
      totalPaid: round2(totalPaid),
      kushkiTicketNumber:
        payment?.kushki_ticket_number ?? undefined,
      paidAt: payment?.created_at,
      createdAt: entry.created_at,
    };
  });

  return {
    leagueType: league.leagueType ?? "free",
    entryFee,
    platformFeePercent: feePercent,
    prizePool: round2(prizePool),
    platformFee: round2(platformFee),
    totalGross: round2(totalGross),
    paidParticipants: entries.filter(
      (entry) => entry.paymentStatus === "approved",
    ).length,
    totalEntries: entries.length,
    currency: "MXN",
    entries,
  };
}

/**
 * Reads the commissioner's saved payout details. Ownership is verified
 * server-side against the league `owner_id`, so this works for authenticated
 * and guest commissioners alike. Returns empty strings when nothing is saved.
 */
export async function getCommissionerPayoutDetails(
  leagueId: string,
  userId: string,
): Promise<PayoutDetails> {
  const query = new URLSearchParams({ leagueId, userId });
  const res = await fetch(
    `/api/payments/payout-details?${query.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "No se pudieron cargar tus datos de retiro.");
  }
  const data = (await res.json()) as PayoutDetails;
  return {
    bankName: data.bankName ?? "",
    clabe: data.clabe ?? "",
    accountHolder: data.accountHolder ?? "",
  };
}

/**
 * Persists the commissioner's bank details via the owner-gated server route.
 * Returns a normalized `PayoutDetails` on success so the form can stay in sync.
 */
export async function saveCommissionerPayoutDetails(
  leagueId: string,
  userId: string,
  details: PayoutDetails,
): Promise<PayoutDetails> {
  const res = await fetch("/api/payments/payout-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId, userId, ...details }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "No se pudieron guardar tus datos de retiro.");
  }
  return {
    bankName: details.bankName.trim(),
    clabe: details.clabe.replace(/\D/g, ""),
    accountHolder: details.accountHolder.trim(),
  };
}

// ── Phase 4: My Leagues (multi-league navigation) ───────────────────────────

/**
 * One league the user is enrolled in (via `public.entries`), aggregated per
 * league. When the user owns several entries in the same league the
 * representative entry is the first alive one (else the first with a pick,
 * else the oldest), so survivor status and the current-week pick stay scannable.
 */
export interface EnrolledLeague {
  leagueId: string;
  leagueName: string;
  leagueStatus: League["status"];
  leagueType?: "paid" | "free";
  entryFee?: number;
  /** Representative entry id (prefer an alive entry). */
  entryId: string;
  entryName: string;
  isCommissioner: boolean;
  isAlive: boolean;
  strikes?: number;
  /** The user's pick for the current (`ACTIVE_WEEK`) week, if any. */
  currentWeekPick?: NFLTeamId;
  /** Total entries in the league (progress denominator). */
  totalEntries: number;
  /** Entries still alive in the league. */
  remainingEntries: number;
  /** How many entries this user has in the league. */
  userEntriesCount: number;
}

/**
 * Loads every league where the current user has an entry, grouped by league,
 * with survivor status and the current-week pick. Powers the "Mis Ligas"
 * dropdown and the `/my-leagues` hub. Returns `[]` when the user has no
 * entries (never mock data).
 */
export async function getUserEnrolledLeaguesInDb(
  userId: string,
): Promise<EnrolledLeague[]> {
  const supabase = createClient();

  const { data: entryRows, error: entriesError } = (await supabase
    .from("entries")
    .select("*")
    .eq("user_id", userId)) as {
    data: EntryRow[] | null;
    error: Error | null;
  };
  if (entriesError) throw entriesError;
  if (!entryRows || entryRows.length === 0) return [];

  const leagueIds = [...new Set(entryRows.map((row) => row.league_id))];
  const entryIds = entryRows.map((row) => row.id);

  const { data: leagueRows, error: leaguesError } = (await supabase
    .from("leagues")
    .select("*")
    .in("id", leagueIds)) as {
    data: LeagueRow[] | null;
    error: Error | null;
  };
  if (leaguesError) throw leaguesError;

  // Current-week pick per entry (the survivor status reads from `entries`,
  // but the pick lives in `picks` keyed by `(entry_id, week)`).
  const { data: pickRows } = (await supabase
    .from("picks")
    .select("entry_id, team_id")
    .in("entry_id", entryIds.length ? entryIds : NO_ROWS)
    .eq("week", ACTIVE_WEEK)) as {
    data: { entry_id: string; team_id: string }[] | null;
  };

  // League-wide progress: total vs alive entries, across all entries.
  const { data: allEntryRows } = (await supabase
    .from("entries")
    .select("league_id, status")
    .in("league_id", leagueIds.length ? leagueIds : NO_ROWS)) as {
    data: { league_id: string; status: EntryStatus }[] | null;
  };

  const pickByEntry = new Map<string, NFLTeamId>();
  for (const pick of pickRows ?? []) {
    pickByEntry.set(pick.entry_id, pick.team_id as NFLTeamId);
  }

  const totalByLeague = new Map<string, number>();
  const aliveByLeague = new Map<string, number>();
  for (const entry of allEntryRows ?? []) {
    totalByLeague.set(
      entry.league_id,
      (totalByLeague.get(entry.league_id) ?? 0) + 1,
    );
    if (entry.status === "alive") {
      aliveByLeague.set(
        entry.league_id,
        (aliveByLeague.get(entry.league_id) ?? 0) + 1,
      );
    }
  }

  const userCountByLeague = new Map<string, number>();
  for (const entry of entryRows) {
    userCountByLeague.set(
      entry.league_id,
      (userCountByLeague.get(entry.league_id) ?? 0) + 1,
    );
  }

  const result: EnrolledLeague[] = [];
  for (const leagueRow of leagueRows ?? []) {
    const league = mapLeague(leagueRow);
    const userEntries = entryRows.filter(
      (entry) => entry.league_id === league.id,
    );
    if (userEntries.length === 0) continue;

    // Prefer an alive entry; else one that already picked this week; else the
    // oldest entry. Keeps the dropdown summary meaningful for multi-entry users.
    const representative =
      userEntries.find((entry) => entry.status === "alive") ??
      userEntries.find((entry) => pickByEntry.has(entry.id)) ??
      userEntries[0];

    result.push({
      leagueId: league.id,
      leagueName: league.name,
      leagueStatus: league.status,
      leagueType: league.leagueType,
      entryFee: league.entryFee,
      entryId: representative.id,
      entryName: representative.entry_name,
      isCommissioner: league.ownerId === userId,
      isAlive: representative.status === "alive",
      strikes: representative.strikes,
      currentWeekPick: pickByEntry.get(representative.id),
      totalEntries: totalByLeague.get(league.id) ?? 0,
      remainingEntries: aliveByLeague.get(league.id) ?? 0,
      userEntriesCount: userCountByLeague.get(league.id) ?? 0,
    });
  }

  // Active first, alive first, then by name — most actionable on top.
  return result.sort((a, b) => {
    if (a.leagueStatus !== b.leagueStatus) {
      return a.leagueStatus === "active" ? -1 : 1;
    }
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return a.leagueName.localeCompare(b.leagueName);
  });
}

/**
 * Loads every league the current user is commissioner of, whether or not they
 * have joined it yet (e.g. a paid league still awaiting the owner's entry
 * payment). Leagues where the user already has an entry are returned here too;
 * callers should merge with `getUserEnrolledLeaguesInDb` and dedupe by
 * `leagueId`, preferring the enrolled row (which carries the real entry data).
 */
export async function getUserCommissionedLeaguesInDb(
  userId: string,
): Promise<EnrolledLeague[]> {
  const supabase = createClient();

  const { data: leagueRows, error: leaguesError } = (await supabase
    .from("leagues")
    .select("*")
    .eq("owner_id", userId)) as {
    data: LeagueRow[] | null;
    error: Error | null;
  };
  if (leaguesError) throw leaguesError;
  if (!leagueRows || leagueRows.length === 0) return [];

  const leagueIds = leagueRows.map((row) => row.id);

  // League-wide progress: total vs alive entries, across all entries.
  const { data: allEntryRows } = (await supabase
    .from("entries")
    .select("league_id, status")
    .in("league_id", leagueIds)) as {
    data: { league_id: string; status: EntryStatus }[] | null;
  };

  const totalByLeague = new Map<string, number>();
  const aliveByLeague = new Map<string, number>();
  for (const entry of allEntryRows ?? []) {
    totalByLeague.set(
      entry.league_id,
      (totalByLeague.get(entry.league_id) ?? 0) + 1,
    );
    if (entry.status === "alive") {
      aliveByLeague.set(
        entry.league_id,
        (aliveByLeague.get(entry.league_id) ?? 0) + 1,
      );
    }
  }

  const result: EnrolledLeague[] = [];
  for (const leagueRow of leagueRows) {
    const league = mapLeague(leagueRow);
    // Synthetic entry row: callers merge with `getUserEnrolledLeaguesInDb`,
    // which supplies the real entry data when the owner has joined their own
    // league. Leagues the owner hasn't joined yet show here without an entry.
    result.push({
      leagueId: league.id,
      leagueName: league.name,
      leagueStatus: league.status,
      leagueType: league.leagueType,
      entryFee: league.entryFee,
      entryId: "",
      entryName: "Sin entrada todavía",
      isCommissioner: true,
      isAlive: true,
      currentWeekPick: undefined,
      totalEntries: totalByLeague.get(league.id) ?? 0,
      remainingEntries: aliveByLeague.get(league.id) ?? 0,
      userEntriesCount: 0,
    });
  }

  return result.sort((a, b) => {
    if (a.leagueStatus !== b.leagueStatus) {
      return a.leagueStatus === "active" ? -1 : 1;
    }
    return a.leagueName.localeCompare(b.leagueName);
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────

const GAMES_CACHE_TTL_MS = 60_000;
const gamesMemoryCache = new Map<
  string,
  { games: NFLGame[]; expiresAt: number }
>();

/**
 * Fetches the real games for a week directly from `public.nfl_games`. There is
 * NO mock fallback: the rows are the single source of truth for the season.
 * Uses an in-memory TTL cache so subsequent week switches feel instantaneous (<200ms).
 */
export async function getNflGamesInDb(
  week: number,
  year = SEASON_YEAR,
): Promise<NFLGame[]> {
  const cacheKey = `${year}_w${week}`;
  const cached = gamesMemoryCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.games;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("nfl_games")
    .select("*")
    .eq("week", week)
    .eq("season_year", year)
    .gte("start_time", `${year}-01-01`)
    .order("start_time", { ascending: true });
  if (error) throw error;

  if (data && data.length > 0) {
    const mapped = data.map(mapNflGame);
    gamesMemoryCache.set(cacheKey, {
      games: mapped,
      expiresAt: Date.now() + GAMES_CACHE_TTL_MS,
    });
    return mapped;
  }

  // Week 18 is synced exactly like every other week — no protection/skip. Rows
  // already present are returned immediately above; when missing (or stale) the
  // auto-sync below triggers an ESPN refresh of the requested week.
  // Auto-sync missing games for week from ESPN API into public.nfl_games.
  try {
    if (typeof window !== "undefined") {
      await fetch(`/api/nfl/scoreboard?week=${week}&year=${year}`, {
        cache: "no-store",
      });
    }
  } catch (syncErr) {
    console.warn(`[survivor-db] Auto-sync trigger failed for week ${week}:`, syncErr);
  }

  const { data: refreshed, error: refError } = await supabase
    .from("nfl_games")
    .select("*")
    .eq("week", week)
    .eq("season_year", year)
    .gte("start_time", `${year}-01-01`)
    .order("start_time", { ascending: true });

  if (!refError && refreshed && refreshed.length > 0) {
    const mapped = refreshed.map(mapNflGame);
    gamesMemoryCache.set(cacheKey, {
      games: mapped,
      expiresAt: Date.now() + GAMES_CACHE_TTL_MS,
    });
    return mapped;
  }

  return (data ?? []).map(mapNflGame);
}

/**
 * Counts how many real games are already stored for a week in
 * `public.nfl_games`. Generic helper (e.g. for seeding/sync tooling).
 */
export async function countGamesForWeekInDb(
  week: number,
  year = SEASON_YEAR,
): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("nfl_games")
    .select("id", { count: "exact", head: true })
    .eq("week", week)
    .eq("season_year", year)
    .gte("start_time", `${year}-01-01`);
  if (error) throw error;

  return count ?? 0;
}

/**
 * Loads a single league from Supabase. Returns `null` when the league does not
 * exist. Never returns mock data — the caller decides how to render a missing
 * league.
 */
export async function getLeagueDetailsInDb(
  leagueId: string,
): Promise<League | null> {
  const supabase = createClient();

  const { data: leagueRow, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;

  return leagueRow ? mapLeague(leagueRow) : null;
}

/**
 * Loads the real leaderboard for a league — aggregated strictly from
 * `public.entries` (via the `league_leaderboard` view) plus each entry's
 * pick history from `public.picks`. Never injects mock participants or
 * pre-filled picks.
 */
export async function getLeagueLeaderboardInDb(
  leagueId: string,
): Promise<{
  leaderboard: LeaderboardParticipant[];
  picksByEntry: Record<string, WeekPicks>;
}> {
  const supabase = createClient();

  const { data: lbRows, error: lbError } = (await supabase
    .from("league_leaderboard")
    .select("*")
    .eq("league_id", leagueId)) as {
    data: LeaderboardRow[] | null;
    error: Error | null;
  };
  if (lbError) throw lbError;

  const entryIds = (lbRows ?? []).map((row) => row.entry_id);
  const userIds = [...new Set((lbRows ?? []).map((row) => row.user_id))];

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds.length ? userIds : NO_ROWS);

  const { data: pickRows } = (await supabase
    .from("picks")
    .select("*")
    .in("entry_id", entryIds.length ? entryIds : NO_ROWS)) as {
    data: PickRow[] | null;
  };

  const displayNameById = new Map(
    (profileRows ?? []).map((row) => [row.id, row.display_name]),
  );

  const allPickRows = pickRows ?? [];

  const picksByEntry: Record<string, WeekPicks> = {};
  for (const row of lbRows ?? []) {
    const map: WeekPicks = {};
    for (const pick of allPickRows) {
      if (pick.entry_id === row.entry_id) {
        map[pick.week] = pick.team_id as NFLTeamId;
      }
    }
    picksByEntry[row.entry_id] = map;
  }

  const leaderboard: LeaderboardParticipant[] = (lbRows ?? []).map((row) => {
    const entryPicks = allPickRows.filter((p) => p.entry_id === row.entry_id);
    const pickHistory: (NFLTeamId | null)[] = Array.from(
      { length: 18 },
      (_, i) => {
        const pick = entryPicks.find((p) => p.week === i + 1);
        return pick ? (pick.team_id as NFLTeamId) : null;
      },
    );

    return {
      id: row.entry_id,
      userId: row.user_id,
      name: displayNameById.get(row.user_id) ?? "Jugador",
      entryName: row.entry_name,
      status: row.status,
      strikes: row.strikes,
      pickHistory,
    };
  });

  return { leaderboard, picksByEntry };
}

/**
 * Loads everything the league dashboard needs: league details, the real
 * leaderboard (with pick history), the current user's entries, their picks and
 * the real `public.nfl_games` for the requested week.
 *
 * Only real Supabase rows are returned — mock data is never injected. When the
 * league does not exist, `league` is `null`; when auxiliary queries fail they
 * degrade to empty lists so a valid league still renders instead of falling
 * back to demo data.
 */
export async function getLeagueDashboardData(
  leagueId: string,
  week: number,
): Promise<LeagueDashboardData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Guests without an auth session persist under their deterministic local
  // UUID, which is also stored in `profiles.id` / `entries.user_id`.
  const userId = user?.id ?? getLocalGuestId();

  // 1) League — a missing league is a clean "not found", never mock.
  const { data: leagueRow, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!leagueRow) {
    return {
      league: null,
      userEntries: [],
      leaderboard: [],
      picksByEntry: {},
      games: [],
    };
  }

  const league = mapLeague(leagueRow);

  // 2) Leaderboard + picks — failures degrade to empty, never to mock.
  let leaderboard: LeaderboardParticipant[] = [];
  let picksByEntry: Record<string, WeekPicks> = {};
  try {
    const lb = await getLeagueLeaderboardInDb(leagueId);
    leaderboard = lb.leaderboard;
    picksByEntry = lb.picksByEntry;
  } catch (err) {
    console.warn("[survivor-db] No se pudo cargar la clasificación:", err);
  }

  // 3) The current user's entries — only real rows from `public.entries`.
  let userEntries: LeagueEntry[] = [];
  try {
    const { data: myEntries, error: myEntriesError } = await supabase
      .from("entries")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    if (myEntriesError) throw myEntriesError;
    userEntries = (myEntries ?? []).map(mapLeagueEntry);
  } catch (err) {
    console.warn("[survivor-db] No se pudieron cargar tus entradas:", err);
  }

  // 4) Real games for the week — straight from `public.nfl_games`, no mock.
  let games: NFLGame[] = [];
  try {
    games = await getNflGamesInDb(week);
  } catch (err) {
    console.warn(
      "[survivor-db] No se pudieron cargar los partidos de la semana:",
      err,
    );
  }

  return { league, userEntries, leaderboard, picksByEntry, games };
}

// ── Picks ───────────────────────────────────────────────────────────────────

/**
 * Submits (upserts) a pick for an entry+week pair, enforcing the survivor
 * rules against the live schedule in `nfl_games`:
 *
 * - **Lock rule:** the picked team's game must not have kicked off yet
 *   (`start_time <= now()` → rejected).
 * - **Team rule:** a team already picked in any earlier week is rejected.
 *
 * The write uses an `upsert` honoring the unique `(entry_id, week)`
 * constraint, so re-submitting the same week updates the existing row.
 */
export async function submitPickInDb(
  entryId: string,
  week: number,
  teamId: NFLTeamId,
): Promise<void> {
  const supabase = createClient();

  // 1) Lock rule — the game must still be scheduled and in the future.
  //    `start_time >= season start` also excludes any legacy/corrupt rows
  //    (e.g. historical 2025 games) so they can never block a valid pick.
  const { data: game, error: gameError } = await supabase
    .from("nfl_games")
    .select("id, start_time, status")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("week", week)
    .eq("season_year", SEASON_YEAR)
    .gte("start_time", `${SEASON_YEAR}-01-01`)
    .limit(1)
    .maybeSingle();
  if (gameError) throw gameError;

  if (game) {
    const started =
      game.status !== "scheduled" ||
      new Date(game.start_time).getTime() <= Date.now();
    if (started) {
      throw new Error(
        "El partido ya comenzó. No puedes cambiar tu pick.",
      );
    }
  }

  // 2) Team rule — no team may be picked twice in a season.
  const { data: previous, error: previousError } = await supabase
    .from("picks")
    .select("week")
    .eq("entry_id", entryId)
    .neq("week", week)
    .eq("team_id", teamId);
  if (previousError) throw previousError;
  if (previous && previous.length > 0) {
    throw new Error(
      `Ya seleccionaste a este equipo en la Semana ${previous[0].week}.`,
    );
  }

  // 3) Persist (upsert honoring the unique `(entry_id, week)` constraint).
  const { error } = await supabase.from("picks").upsert(
    { entry_id: entryId, week, team_id: teamId, result: "pending" },
    { onConflict: "entry_id,week" },
  );
  if (error) throw error;
}

// ── Ticket Tokens (Lippu.app / Bubble.io integration) ───────────────────────

interface TicketTokenRow {
  id: string;
  code: string;
  league_id: string;
  entries_count: number;
  user_email: string | null;
  status: "available" | "redeemed" | "expired";
  redeemed_at: string | null;
}

/**
 * Looks up a ticket token by its public redemption code, returning the
 * normalized token plus the league id it grants access to. Returns `null`
 * when the code doesn't exist.
 */
export async function getTicketToken(
  ticketCode: string,
): Promise<TicketTokenRow | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("ticket_tokens")
    .select("*")
    .eq("code", ticketCode.trim().toUpperCase())
    .maybeSingle();

  return (data as TicketTokenRow | null) ?? null;
}

/**
 * Mints a new ticket token in Supabase for Lippu to grant entries later.
 * Used server-side by `/api/v1/tickets/create`.
 */
export async function createTicketTokenInDb(
  payload: TicketTokenPayload,
): Promise<{ ticketId: string }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ticket_tokens")
    .insert({
      code: payload.ticketCode.trim().toUpperCase(),
      league_id: payload.leagueId,
      entries_count: payload.entriesCount ?? 1,
      user_email: payload.userEmail ?? null,
      status: "available",
    })
    .select("id")
    .single();
  if (error) throw error;

  return { ticketId: data.id };
}

/**
 * Redeems an available ticket token and creates `entries_count` entries for
 * the given user inside the token's league. Returns the league id + the
 * created entry ids.
 */
export async function redeemTicketInDb(
  ticketCode: string,
  userId: string,
): Promise<TicketRedeemResult> {
  const supabase = createClient();

  const token = await getTicketToken(ticketCode);
  if (!token) {
    throw new Error("No encontramos un ticket con ese código.");
  }
  if (token.status !== "available") {
    throw new Error("Este ticket ya fue canjeado.");
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, capacity")
    .eq("id", token.league_id)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!league) {
    throw new Error("La liga asociada a este ticket ya no existe.");
  }

  const { count: totalEntries } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", token.league_id);

  if (
    league.capacity !== null &&
    totalEntries !== null &&
    totalEntries >= league.capacity
  ) {
    throw new Error("Esta liga ya está llena.");
  }

  const { data: existingNames } = await supabase
    .from("entries")
    .select("entry_name")
    .eq("league_id", token.league_id);
  const names = new Set((existingNames ?? []).map((row) => row.entry_name));

  const entryIds: string[] = [];
  for (let i = 1; i <= token.entries_count; i++) {
    let entryName = `Entrada #${i}`;
    let suffix = 2;
    while (names.has(entryName)) {
      entryName = `Entrada #${suffix}`;
      suffix += 1;
    }
    names.add(entryName);

    const { data: entry, error: entryError } = await supabase
      .from("entries")
      .insert({
        user_id: userId,
        league_id: token.league_id,
        entry_name: entryName,
      })
      .select("id")
      .single();
    if (entryError) throw entryError;
    entryIds.push(entry.id);
  }

  const { error: redeemError } = await supabase
    .from("ticket_tokens")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_by: userId,
    })
    .eq("id", token.id);
  if (redeemError) throw redeemError;

  return {
    leagueId: token.league_id,
    leagueName: league.name,
    entryIds,
    entriesCount: entryIds.length,
  };
}
