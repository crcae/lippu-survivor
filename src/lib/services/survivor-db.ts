"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  EntryStatus,
  League,
  LeaderboardParticipant,
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
  /** Defaults to `20` (one per purchased ticket) when omitted. */
  maxEntriesPerUser?: number;
  strikesAllowed: number;
  /** Defaults to `0` (monetization happens on Lippu.app) when omitted. */
  entryFee?: number;
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
}

export interface LeagueDashboardData {
  league: League | null;
  userEntries: LeagueEntry[];
  leaderboard: LeaderboardParticipant[];
  /** Picks grouped by entry id, so multi-entry contexts stay isolated. */
  picksByEntry: Record<string, WeekPicks>;
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

  console.log("[survivor-db] User profile check/creation...", { userId: user.id, isGuest: user.isGuest ?? false });
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

  console.log("[survivor-db] Inserting league row...", { name: payload.name, inviteCode: payload.inviteCode });
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .insert({
      name: payload.name,
      owner_id: user.id,
      season_year: payload.seasonYear,
      max_entries_per_user: payload.maxEntriesPerUser ?? 20,
      capacity: payload.capacity ?? null,
      strikes_allowed: payload.strikesAllowed,
      entry_fee: payload.entryFee ?? 0,
      invite_code: payload.inviteCode,
      status: "active",
    })
    .select("id")
    .single();
  if (leagueError) throwSupabaseError("inserción de la liga", leagueError);

  console.log("[survivor-db] Inserting owner entry row...", { leagueId: league.id });
  const { error: entryError } = await supabase.from("entries").insert({
    user_id: user.id,
    league_id: league.id,
    entry_name: `Entrada 1 - ${user.displayName}`,
  });
  if (entryError) throwSupabaseError("inserción de la entrada del dueño", entryError);

  console.log("[survivor-db] League created", { leagueId: league.id });
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
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!leagueRow) return null;

  const { count } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueRow.id);

  return { league: mapLeague(leagueRow), entryCount: count ?? 0 };
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

// ── Dashboard ───────────────────────────────────────────────────────────────

/**
 * Loads everything the league dashboard needs: league details, the
 * leaderboard (with pick history), the current user's entries and their picks.
 */
export async function getLeagueDashboardData(
  leagueId: string,
): Promise<LeagueDashboardData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  const { data: leagueRow, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) throw leagueError;
  if (!leagueRow) {
    return { league: null, userEntries: [], leaderboard: [], picksByEntry: {} };
  }

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

  const picksByEntry: Record<string, WeekPicks> = {};
  const allPickRows = pickRows ?? [];

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
      name: displayNameById.get(row.user_id) ?? "Jugador",
      entryName: row.entry_name,
      status: row.status,
      strikes: row.strikes,
      pickHistory,
    };
  });

  let userEntries: LeagueEntry[] = [];

  if (userId) {
    const { data: myEntries } = await supabase
      .from("entries")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    userEntries = (myEntries ?? []).map(mapLeagueEntry);

    for (const entry of userEntries) {
      const entryPicks = allPickRows.filter((p) => p.entry_id === entry.id);
      const map: WeekPicks = {};
      for (const pick of entryPicks) {
        map[pick.week] = pick.team_id as NFLTeamId;
      }
      picksByEntry[entry.id] = map;
    }
  }

  return {
    league: mapLeague(leagueRow),
    userEntries,
    leaderboard,
    picksByEntry,
  };
}

// ── Picks ───────────────────────────────────────────────────────────────────

/**
 * Upserts a pick for an entry+week pair, honoring the unique
 * `(entry_id, week)` constraint.
 */
export async function savePickInDb(
  entryId: string,
  week: number,
  teamId: NFLTeamId,
): Promise<void> {
  const supabase = createClient();

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
