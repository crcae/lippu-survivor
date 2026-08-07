#!/usr/bin/env node
/**
 * Reconciles orphaned Kushki charge tickets that were approved by the gateway
 * but never persisted (payment + membership staged after a transient DB
 * failure). It reconstructs the missing records using the service-role client
 * (RLS bypass) and, when identifiers are missing, falls back to the Kushki
 * charge metadata / charge-status API.
 *
 * Usage:
 *   node scripts/reconcile-kushki-payments.mjs --ticket=<number> [flags]
 *
 * Flags (any of these pins a value; otherwise auto-resolved):
 *   --user=<uuid>    user id (from Supabase profiles)
 *   --league=<uuid>  league id
 *   --amount=<pesos> exact total charged (e.g. 2.16)
 *   --dry-run        report only, write nothing
 *
 * Env read from .env.local when present:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   KUSHKI_PRIVATE_MERCHANT_ID (optional; used to query the charge)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_TICKET = "821786070994638333";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function parseArgs() {
  const args = { ticket: DEFAULT_TICKET, user: null, league: null, amount: null, dryRun: false };
  for (const raw of process.argv.slice(2)) {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    const value = rest.join("=");
    if (key === "ticket" && value) args.ticket = value;
    if (key === "user" && value) args.user = value;
    if (key === "league" && value) args.league = value;
    if (key === "amount" && value) args.amount = Number(value);
    if (key === "dry-run") args.dryRun = true;
  }
  return args;
}

const args = parseArgs();
const env = { ...process.env, ...loadEnvLocal() };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[reconcile] Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const kushkiPrivateMerchantId =
  env.KUSHKI_PRIVATE_MERCHANT_ID ?? "57ab8da330bf4fcd94082346992e823e";

async function fetchKushkiCharge(ticket) {
  if (!kushkiPrivateMerchantId) return null;
  try {
    const res = await fetch(
      `https://api.kushkipagos.com/card/v1/charges/${encodeURIComponent(ticket)}`,
      { headers: { "Private-Merchant-Id": kushkiPrivateMerchantId } },
    );
    if (!res.ok) {
      console.warn(`[reconcile] Kushki charge query falló (HTTP ${res.status})`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("[reconcile] No se pudo consultar el cargo en Kushki:", err.message);
    return null;
  }
}

async function main() {
  console.log(`[reconcile] Ticket: ${args.ticket}${args.dryRun ? " (DRY RUN)" : ""}`);

  const { data: existing, error: existingError } = await admin
    .from("payments")
    .select("*")
    .eq("kushki_ticket_number", args.ticket)
    .maybeSingle();
  if (existingError) {
    console.error("[reconcile] Error consultando payments:", existingError);
    process.exit(1);
  }
  if (existing) {
    console.log("[reconcile] El ticket ya está reconciliado en payments:");
    console.log(JSON.stringify(existing, null, 2));
    process.exit(0);
  }

  const charge = await fetchKushkiCharge(args.ticket);
  const meta = charge?.metadata ?? {};

  const userId = args.user ?? meta.user_id ?? null;
  const leagueId = args.league ?? meta.league_id ?? null;
  const amount = args.amount ?? Number(meta.total_amount) ?? null;
  const playerName = meta.user_name ?? null;
  const leagueName = meta.event_name ?? null;
  const email = charge?.contactDetails?.email ?? meta.email ?? null;

  let resolvedUser = userId;
  if (!resolvedUser) {
    if (email) {
      const { data } = await admin
        .from("profiles")
        .select("id, email, display_name")
        .eq("email", email)
        .maybeSingle();
      resolvedUser = data?.id ?? null;
    }
    if (!resolvedUser && playerName) {
      const { data } = await admin
        .from("profiles")
        .select("id, display_name")
        .eq("display_name", playerName)
        .limit(1);
      resolvedUser = data?.[0]?.id ?? null;
    }
  }

  let resolvedLeague = leagueId;
  if (!resolvedLeague && leagueName) {
    const { data } = await admin
      .from("leagues")
      .select("id, name, entry_fee")
      .eq("name", leagueName)
      .limit(1);
    resolvedLeague = data?.[0]?.id ?? null;
  }

  if (!resolvedUser || !resolvedLeague) {
    console.error("[reconcile] No se pudo resolver el usuario o la liga. Datos:");
    console.error(JSON.stringify({ userId, leagueId, playerName, leagueName, email, charge }, null, 2));
    console.error(
      "[reconcile] Pasa --user=<uuid> y --league=<uuid> (y --amount) para forzar la reconciliación.",
    );
    process.exit(1);
  }

  const { data: league } = await admin
    .from("leagues")
    .select("id, entry_fee, platform_fee_percent, name")
    .eq("id", resolvedLeague)
    .single();
  const entryFee = Number(league?.entry_fee ?? amount ?? 0);
  const feePercent = Number(league?.platform_fee_percent ?? 8);
  const serviceFee = Number((entryFee * (feePercent / 100)).toFixed(2));
  const total = Number((entryFee + serviceFee).toFixed(2));

  const { data: existingEntry } = await admin
    .from("entries")
    .select("id")
    .eq("league_id", resolvedLeague)
    .eq("user_id", resolvedUser)
    .maybeSingle();
  let entryId = existingEntry?.id ?? null;
  if (!entryId) {
    if (args.dryRun) {
      console.log("[reconcile] (dry-run) Se insertaría entry (participante).");
    } else {
      const { data: entry, error: entryError } = await admin
        .from("entries")
        .insert({
          league_id: resolvedLeague,
          user_id: resolvedUser,
          entry_name: meta.entry_name ?? "Entrada #1",
        })
        .select("id")
        .single();
      if (entryError) {
        console.error("[reconcile] Error insertando entry:", entryError);
        process.exit(1);
      }
      entryId = entry.id;
    }
  }

  let paymentId = null;
  if (!args.dryRun) {
    // Match the charge route: try the spec-shaped `payments` columns first,
    // then the canonical (legacy) shape, each with status 'completed' before
    // 'approved'. Explicit logs for every attempt.
    const specInsert = (status) =>
      admin
        .from("payments")
        .insert({
          user_id: resolvedUser,
          league_id: resolvedLeague,
          amount: total,
          entry_fee: entryFee,
          service_fee: serviceFee,
          ticket: args.ticket,
          status,
          provider: "kushki",
        })
        .select("id")
        .single();
    const canonicalInsert = (status) =>
      admin
        .from("payments")
        .insert({
          league_id: resolvedLeague,
          user_id: resolvedUser,
          entry_id: entryId ?? undefined,
          ticket_amount: entryFee,
          platform_fee_amount: serviceFee,
          total_paid: total,
          currency: "MXN",
          kushki_ticket_number: args.ticket,
          status,
        })
        .select("id")
        .single();

    for (const attempt of [
      () => specInsert("completed"),
      () => specInsert("approved"),
      () => canonicalInsert("completed"),
      () => canonicalInsert("approved"),
    ]) {
      try {
        const res = await attempt();
        if (res.error) throw res.error;
        paymentId = res.data.id;
        console.log(`[reconcile] Payment insertó correctamente (id=${paymentId})`);
        break;
      } catch (err) {
        console.warn("[reconcile] Intento de insert en payments falló:", err.message);
      }
    }
    if (!paymentId) {
      console.error("[reconcile] No se pudo insertar el pago en `payments` (4 intentos).");
    }
    await admin
      .from("league_participants")
      .upsert(
        {
          league_id: resolvedLeague,
          user_id: resolvedUser,
          payment_id: paymentId ?? undefined,
          status: "active",
          joined_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id" },
      );
    const { count } = await admin
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("league_id", resolvedLeague)
      .eq("status", "alive");
    await admin
      .from("leagues")
      .update({ bolsa_total: entryFee * (count ?? 1) })
      .eq("id", resolvedLeague);
    console.log(`[reconcile] Reconciliado: ticket=${args.ticket} user=${resolvedUser} league=${resolvedLeague} payment=${paymentId} total=${total}`);
  } else {
    console.log("[reconcile] (dry-run) Se escribiría: payment + league_participants + bolsa_total.");
    console.log(JSON.stringify({ ticket: args.ticket, user: resolvedUser, league: resolvedLeague, entryFee, serviceFee, total }, null, 2));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[reconcile] Error inesperado:", err);
  process.exit(1);
});
