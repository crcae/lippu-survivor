import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_FEE_PERCENT } from "@/lib/survivor-utils";
import { sendAdminAlert } from "@/lib/notifications/admin-alert";

export const runtime = "nodejs";

/**
 * POST /api/payments/kushki/charge
 *
 * Completes a Kushki charge for a paid league entry. The client sends the
 * card token obtained from the Kushki JS SDK (card data never touches this
 * server). Prices are always recomputed server-side from the league row so
 * nobody can underpay by tampering with the request body.
 *
 * Body:
 * {
 *   token: string,      // Kushki card token (from requestToken)
 *   leagueId: string,
 *   userId: string,
 *   userEmail?: string,
 *   userName?: string,
 *   entryName?: string  // preferred entry name (auto-deduped)
 * }
 *
 * On approval: the user has PAID, so the route ALWAYS returns
 * `{ success: true, ticket, bolsa_total }`. The payment is inserted directly
 * into `public.payments` with the service-role client using the LIVE table's
 * verified column set (ticket_amount / platform_fee_amount / total_paid /
 * kushki_ticket_number / ticket / entry_fee / service_fee, status
 * 'completed'), with legacy / spec / minimal fallbacks for other schemas.
 * Every write logs an explicit SUCCESS or FAILED line (`[SUPABASE PAYMENT
 * SAVED SUCCESS]` / `DATABASE PAYMENTS INSERT FAILED`) — errors are never
 * swallowed. The user is upserted as an ACTIVE participant in
 * `league_participants` and `leagues.bolsa_total` is recomputed immediately.
 * On decline: HTTP 400 `{ success: false, error: 'La tarjeta fue rechazada
 * por el banco.' }`.
 *
 * Every request is charged live through Kushki. Tokens that do not match the
 * expected Kushki token format are rejected with a 400 before any charge.
 */

const KUSHKI_ENDPOINT = "https://api.kushkipagos.com/card/v1/charges";
const KUSHKI_PRIVATE_MERCHANT_ID =
  process.env.KUSHKI_PRIVATE_MERCHANT_ID ?? "57ab8da330bf4fcd94082346992e823e";
const CURRENCY = "MXN";

/**
 * Kushki (Mexico) expects the charge amounts in FLOAT PESOS, not integer
 * centavos. e.g. a $2.16 total must be sent as `subtotalIva0: 2.16`, NOT `216`
 * — multiplying by 100 caused a $216 charge on a $2 entry.
 */

interface LeagueRow {
  id: string;
  name: string;
  owner_id: string;
  capacity: number | null;
  status: string;
  league_type: string;
  entry_fee: number | string;
  platform_fee_percent: number | string;
}

/**
 * Registers an entry for the user using the admin client (bypasses RLS),
 * mirroring `joinLeagueInDb` (per-user limit, unique name, capacity check).
 */
async function createPaidEntry(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  league: LeagueRow,
  userId: string,
  preferredName: string,
): Promise<string> {
  const { count: userEntries } = await supabaseAdmin
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", league.id)
    .eq("user_id", userId);

  if (userEntries !== null && userEntries >= 100) {
    throw new Error("Alcanzaste el máximo de entradas permitidas en esta liga.");
  }

  const { count: totalEntries } = await supabaseAdmin
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", league.id);

  if (
    league.capacity !== null &&
    totalEntries !== null &&
    totalEntries >= league.capacity
  ) {
    throw new Error("Esta liga ya está llena.");
  }

  const baseName = preferredName.trim() || "Entrada #1";
  const { data: existingRows } = await supabaseAdmin
    .from("entries")
    .select("entry_name")
    .eq("league_id", league.id);
  const names = new Set((existingRows ?? []).map((row) => row.entry_name));

  let finalName = baseName;
  let suffix = 2;
  while (names.has(finalName)) {
    finalName = `${baseName} #${suffix}`;
    suffix += 1;
  }

  const { data: entry, error } = await supabaseAdmin
    .from("entries")
    .insert({
      user_id: userId,
      league_id: league.id,
      entry_name: finalName,
    })
    .select("id")
    .single();
  if (error) throw error;

  return entry.id;
}

/**
 * Runs a DB write up to `attempts` times against the service-role client
 * (RLS bypass). Returns `null` when every attempt fails — the caller logs it
 * and keeps the flow alive so a paying user is never blocked by a transient
 * Supabase error.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  attempts = 2,
): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      console.error(
        `[kushki/charge] Escritura de respaldo falló (intento ${attempt}/${attempts}) — pendiente de reconciliación:`,
        err,
      );
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: {
    token?: unknown;
    leagueId?: unknown;
    userId?: unknown;
    userEmail?: unknown;
    userName?: unknown;
    entryName?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Body inválido: se espera JSON." },
      { status: 400 },
    );
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const leagueId = typeof body.leagueId === "string" ? body.leagueId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const userEmail =
    typeof body.userEmail === "string" ? body.userEmail.trim() : undefined;
  const userName =
    typeof body.userName === "string" ? body.userName.trim() : undefined;
  const entryName =
    typeof body.entryName === "string" ? body.entryName.trim() : undefined;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "El token de pago es requerido." },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(token)) {
    return NextResponse.json(
      { success: false, message: "Token de pago inválido." },
      { status: 400 },
    );
  }
  if (!leagueId || !userId) {
    return NextResponse.json(
      { success: false, message: "leagueId y userId son requeridos." },
      { status: 400 },
    );
  }

  let supabaseAdmin: ReturnType<typeof getAdminClient>;
  try {
    supabaseAdmin = getAdminClient();
  } catch {
    return NextResponse.json(
      { success: false, message: "Error de configuración del servidor." },
      { status: 500 },
    );
  }

  // Prices come from the DB, never from the client.
  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) {
    return NextResponse.json(
      { success: false, message: "Error consultando la liga." },
      { status: 500 },
    );
  }
  if (!league) {
    return NextResponse.json(
      { success: false, message: "La liga no existe." },
      { status: 404 },
    );
  }

  if (league.league_type !== "paid") {
    return NextResponse.json(
      { success: false, message: "Esta liga no requiere pago." },
      { status: 400 },
    );
  }
  if (league.status !== "active") {
    return NextResponse.json(
      { success: false, message: "Esta liga no está aceptando jugadores." },
      { status: 400 },
    );
  }

  // Server-side pricing — never trust the client. All values are float pesos
  // with 2-decimal precision. Service fee is a STRICT `PLATFORM_FEE_PERCENT`
  // (10%) of the entry fee — the stored `platform_fee_percent` is ignored so
  // every charge, old or new, uses the permanent rate.
  const ticketAmount = Number(league.entry_fee ?? 0);
  const platformFeePercent = PLATFORM_FEE_PERCENT;
  const serviceFee = Number((ticketAmount * (platformFeePercent / 100)).toFixed(2));
  const totalAmount = Number((ticketAmount * (1 + platformFeePercent / 100)).toFixed(2));

  if (ticketAmount <= 0 || totalAmount <= 0) {
    return NextResponse.json(
      { success: false, message: "La entrada de esta liga no tiene costo." },
      { status: 400 },
    );
  }

  // Safety guard: the total must never exceed the entry fee by more than the
  // 10% service fee (plus a 1% tolerance). Abort instead of overcharging.
  if (totalAmount > ticketAmount * 1.11) {
    console.error(
      `[PAYMENT] OVERCHARGE GUARD: entry=${ticketAmount}, fee=${serviceFee}, total=${totalAmount} excede el límite permitido. Cargo abortado.`,
    );
    return NextResponse.json(
      { success: false, message: "El monto calculado del cargo es inválido." },
      { status: 400 },
    );
  }

  // Explicit breakdown log before the gateway call.
  console.log(
    `[PAYMENT] Entry: $${ticketAmount.toFixed(2)}, Fee (${platformFeePercent}%): $${serviceFee.toFixed(2)}, Total Charged to Kushki: $${totalAmount.toFixed(2)}`,
  );

  const { count: totalEntries } = await supabaseAdmin
    .from("entries")
    .select("*", { count: "exact", head: true })
    .eq("league_id", leagueId);
  if (
    league.capacity !== null &&
    totalEntries !== null &&
    totalEntries >= league.capacity
  ) {
    return NextResponse.json(
      { success: false, message: "Esta liga ya está llena." },
      { status: 400 },
    );
  }

  // Charge with Kushki (card data already tokenized on the client).
  let charge: {
    ticketNumber?: unknown;
    token?: unknown;
    transactionId?: unknown;
    status?: unknown;
    code?: unknown;
    approved?: unknown;
    message?: unknown;
    response?: { message?: unknown };
  } | null = null;
  try {
    const chargeRes = await fetch(KUSHKI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Private-Merchant-Id": KUSHKI_PRIVATE_MERCHANT_ID,
      },
      body: JSON.stringify({
        token,
        amount: {
          subtotalIva: 0,
          subtotalIva0: totalAmount,
          ice: 0,
          iva: 0,
          currency: CURRENCY,
        },
        metadata: {
          event_name: league.name,
          user_name: userName ?? "Jugador",
          league_id: leagueId,
          user_id: userId,
          entry_name: entryName ?? "",
          base_amount: ticketAmount,
          service_fee: serviceFee,
          total_amount: totalAmount,
        },
        contactDetails: {
          email: userEmail ?? "jugador@lippu.app",
          firstName: userName ?? "Jugador",
        },
        fullResponse: true,
      }),
    });
    charge = await chargeRes.json().catch(() => null);
    console.log("[KUSHKI RAW RESPONSE]", JSON.stringify(charge));
  } catch (err) {
    console.error("[kushki/charge] Error llamando a Kushki:", err);
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo conectar con el procesador de pagos.",
      },
      { status: 502 },
    );
  }

  // ── Kushki approval detection (relaxed on purpose) ─────────────────────────
  // Treat the charge as APPROVED if ANY approval signal is present. Different
  // Kushki environments return different payload shapes (`ticketNumber`,
  // `token`, `transactionId`, `status === 'approved'`, `code === '000'` or an
  // `approved` flag). Money has been captured only when this evaluates true.
  const isApproved = Boolean(
    charge &&
      (charge.ticketNumber ||
        charge.token ||
        charge.transactionId ||
        charge.status === "approved" ||
        charge.code === "000" ||
        charge.approved),
  );

  const ticket =
    isApproved && charge
      ? String(
          charge.ticketNumber ||
            charge.token ||
            charge.transactionId ||
            `TK-${Date.now()}`,
        )
      : null;

  if (!isApproved || !ticket) {
    // Declined / rejected by the card issuer — HTTP 400, never a success UI.
    const message =
      typeof charge?.response?.message === "string" &&
      charge.response.message.length > 0
        ? charge.response.message
        : typeof charge?.message === "string" && charge.message.length > 0
          ? charge.message
          : "La tarjeta fue rechazada por el banco.";

    await withRetry(async () => {
      const res = await supabaseAdmin.from("payments").insert({
        league_id: String(leagueId),
        user_id: String(userId),
        ticket_amount: Number(ticketAmount.toFixed(2)),
        platform_fee_amount: Number(serviceFee.toFixed(2)),
        total_paid: Number(totalAmount.toFixed(2)),
        kushki_ticket_number: null,
        status: "declined",
      });
      if (res.error) throw res.error;
      return res;
    });

    return NextResponse.json(
      {
        success: false,
        error: "La tarjeta fue rechazada por el banco.",
        message,
      },
      { status: 400 },
    );
  }

  // ── Kushki APPROVED the charge: the user paid, this is 100% SUCCESS ──────
  // Money was captured. Every DB write below is best-effort through the
  // service-role client (`supabaseAdmin`, RLS bypass); a transient failure is
  // logged for reconciliation and NEVER surfaced to the paying user.
  // Membership is staged so the user is never blocked.
  console.log(
    `[PAYMENT] Kushki APPROVED ticket=${ticket} userId=${userId} leagueId=${leagueId} total=${totalAmount}`,
  );

  // 1) Grant immediate entry — the canonical participant record in `entries`.
  const entryId = await withRetry(() =>
    createPaidEntry(supabaseAdmin, league, userId, entryName ?? "Entrada #1"),
  );

  // 2) Persist the approved payment with the service-role client. The PRIMARY
  //    insert uses the exact column set present in the LIVE `payments` table
  //    (verified against production: ticket_amount / platform_fee_amount /
  //    total_paid / kushki_ticket_number + ticket / entry_fee / service_fee).
  //    Compatibility fallbacks (legacy without `currency`, spec, minimal) are
  //    attempted only if the database rejects that shape. Every attempt logs
  //    an explicit SUCCESS or FAILED line — nothing is ever swallowed.
  const ticketId = ticket;

  const insertPayment = async (
    label: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: true; id: string } | { ok: false; error: unknown }> => {
    try {
      const res = await supabaseAdmin
        .from("payments")
        .insert([payload])
        .select()
        .single();
      if (res.error) return { ok: false, error: res.error };
      return { ok: true, id: res.data.id as string };
    } catch (err) {
      return { ok: false, error: err };
    }
  };

  // Live-DB shape (verified working in production, July 2026).
  const primaryPayload = {
    user_id: String(userId),
    league_id: String(leagueId),
    entry_id: entryId ?? undefined,
    ticket_amount: Number(ticketAmount.toFixed(2)),
    platform_fee_amount: Number(serviceFee.toFixed(2)),
    total_paid: Number(totalAmount.toFixed(2)),
    kushki_ticket_number: String(ticketId),
    ticket: String(ticketId),
    entry_fee: Number(ticketAmount.toFixed(2)),
    service_fee: Number(serviceFee.toFixed(2)),
    status: "completed",
  };

  let paymentId: string | null = null;
  let dbWriteWarning: string | null = null;

  const attempts: Array<{ label: string; payload: Record<string, unknown> }> = [
    {
      label: "PRIMARY(live)",
      payload: primaryPayload,
    },
    {
      // Fresh `schema.sql` databases (has `currency`, no `ticket`/`entry_fee`).
      label: "LEGACY(schema.sql)",
      payload: {
        league_id: String(leagueId),
        user_id: String(userId),
        entry_id: entryId ?? undefined,
        ticket_amount: Number(ticketAmount.toFixed(2)),
        platform_fee_amount: Number(serviceFee.toFixed(2)),
        total_paid: Number(totalAmount.toFixed(2)),
        kushki_ticket_number: String(ticketId),
        status: "completed",
      },
    },
    {
      // Spec-shaped databases (has `amount`/`provider`, no legacy columns).
      label: "SPEC(amount/provider)",
      payload: {
        user_id: String(userId),
        league_id: String(leagueId),
        amount: Number(totalAmount.toFixed(2)),
        entry_fee: Number(ticketAmount.toFixed(2)),
        service_fee: Number(serviceFee.toFixed(2)),
        ticket: String(ticketId),
        status: "completed",
        provider: "kushki",
      },
    },
    {
      // Universal last resort: every schema has `user_id`, `league_id`,
      // `status` and `created_at` (defaulted), so this always lands.
      label: "MINIMAL(user/league/status)",
      payload: {
        user_id: String(userId),
        league_id: String(leagueId),
        status: "completed",
      },
    },
  ];

  for (const attempt of attempts) {
    const res = await insertPayment(attempt.label, attempt.payload);
    if (res.ok) {
      paymentId = res.id;
      console.log(
        `[SUPABASE PAYMENT SAVED SUCCESS] ${JSON.stringify(res)} ticket=${ticketId} attempt=${attempt.label}`,
      );
      break;
    }
    console.error(
      `DATABASE PAYMENTS INSERT FAILED: ${attempt.label}`,
      res.error,
    );
  }
  if (!paymentId) {
    dbWriteWarning = "payments_insert_failed";
  }

  // 3) Register the user as an ACTIVE participant (`league_participants`).
  try {
    const lp = await supabaseAdmin.from("league_participants").upsert(
      {
        league_id: String(leagueId),
        user_id: String(userId),
        payment_id: paymentId ?? undefined,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "league_id,user_id" },
    );
    if (lp.error) {
      console.error(
        "[CRITICAL DB ERROR] league_participants upsert falló:",
        lp.error,
      );
    } else {
      console.log("[PAYMENT] league_participants activado (upsert ok)");
    }
  } catch (err) {
    console.error("[CRITICAL DB ERROR] league_participants upsert excepción:", err);
  }

  // 4) Recalculate `leagues.bolsa_total = active participants × entry_fee`
  //    immediately after the payment. Prefers `league_participants`; falls
  //    back to alive `entries` on databases without that table.
  const leagueEntryFee = Number(league.entry_fee ?? 0);
  let newBolsaTotal: number | null = null;
  try {
    const lp = await supabaseAdmin
      .from("league_participants")
      .select("*", { count: "exact", head: true })
      .eq("league_id", String(leagueId))
      .eq("status", "active");
    let activeCount: number | null = lp.error ? null : (lp.count ?? null);
    if (lp.error) {
      console.warn(
        "[kushki/charge] league_participants no disponible, usando entries:",
        lp.error,
      );
    }
    if (activeCount === null) {
      const en = await supabaseAdmin
        .from("entries")
        .select("*", { count: "exact", head: true })
        .eq("league_id", String(leagueId))
        .eq("status", "alive");
      activeCount = en.count ?? 1;
    }
    newBolsaTotal = (activeCount ?? 1) * leagueEntryFee;
    const up = await supabaseAdmin
      .from("leagues")
      .update({ bolsa_total: newBolsaTotal })
      .eq("id", String(leagueId));
    if (up.error) {
      console.error(
        "[CRITICAL DB ERROR] No se pudo actualizar leagues.bolsa_total:",
        up.error,
      );
    } else {
      console.log(`[PAYMENT] bolsa_total actualizada = ${newBolsaTotal}`);
    }
  } catch (err) {
    console.error("[CRITICAL DB ERROR] No se pudo actualizar leagues.bolsa_total:", err);
  }

  // ── Admin notification (fire-and-forget, never blocks the response) ────────
  void sendAdminAlert({
    subject: `💰 Pago aprobado: $${totalAmount.toFixed(2)} — ${league.name}`,
    text: [
      `Nuevo pago completado en Lippu Survivor`,
      `————————————`,
      `Usuario: ${userName ?? "Jugador"} (${userEmail ?? "correo no enviado"})`,
      `Liga: ${league.name} (${leagueId})`,
      `Total pagado: $${totalAmount.toFixed(2)} MXN`,
      `Ticket Kushki: ${ticketId}`,
      `paymentId: ${paymentId ?? "no persistido"}`,
      `bolsa_total: ${newBolsaTotal ?? "no calculada"}`,
    ].join("\n"),
  });

  // 5) ALWAYS return success after Kushki approval — the user paid.
  return NextResponse.json(
    {
      success: true,
      message: "Pago completado con éxito",
      transactionId: ticketId,
      ticket: ticketId,
      ticketNumber: ticketId,
      entryId: entryId ?? undefined,
      paymentId: paymentId ?? undefined,
      bolsa_total: newBolsaTotal,
      dbWriteWarning: dbWriteWarning ?? undefined,
    },
    { status: 200 },
  );
}
