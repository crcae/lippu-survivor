import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

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
 * `{ success: true, message: 'Pago completado con éxito', transactionId }`.
 * The entry, the `payments` row (status 'completed'), the
 * `league_participants` membership and the `leagues.bolsa_total` refresh are
 * all written best-effort with the service-role client (`supabaseAdmin`, RLS
 * bypass) and automatic retry — a transient DB failure is logged for
 * reconciliation and never surfaced to the paying user. On decline: HTTP 400
 * `{ success: false, error: 'La tarjeta fue rechazada por el banco.' }`.
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
  // with 2-decimal precision.
  const ticketAmount = Number(league.entry_fee ?? 0);
  const platformFeePercent = Number(league.platform_fee_percent ?? 8);
  const serviceFee = Number((ticketAmount * (platformFeePercent / 100)).toFixed(2));
  const totalAmount = Number((ticketAmount + serviceFee).toFixed(2));

  if (ticketAmount <= 0 || totalAmount <= 0) {
    return NextResponse.json(
      { success: false, message: "La entrada de esta liga no tiene costo." },
      { status: 400 },
    );
  }

  // Safety guard: the total must never exceed the entry fee by more than the
  // 8% service fee (plus a 1% tolerance). Abort instead of overcharging.
  if (totalAmount > ticketAmount * 1.09) {
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

  const ticketNumber =
    typeof charge?.ticketNumber === "string" ? charge.ticketNumber : null;

  if (!ticketNumber) {
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
        league_id: leagueId,
        user_id: userId,
        ticket_amount: ticketAmount,
        platform_fee_amount: serviceFee,
        total_paid: totalAmount,
        currency: CURRENCY,
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
  // service-role client (`supabaseAdmin`, RLS bypass) with automatic retry; a
  // transient failure is logged for reconciliation and NEVER surfaced to the
  // paying user. Membership is staged so the user is never blocked.
  console.log(
    `[PAYMENT] Kushki APPROVED ticket=${ticketNumber} userId=${userId} leagueId=${leagueId} total=${totalAmount}`,
  );

  // 1) Grant immediate entry — the canonical participant record in `entries`.
  const entryId = await withRetry(() =>
    createPaidEntry(supabaseAdmin, league, userId, entryName ?? "Entrada #1"),
  );

  // 2) Persist the approved payment with the service-role client. The insert
  //    is adaptive: it tries the canonical `payments` columns (status
  //    'completed', falling back to the legacy 'approved' marker on databases
  //    whose check-constraint predates it), then the spec-shaped columns
  //    (amount/entry_fee/service_fee/ticket/provider). Whichever shape the
  //    live database accepts wins; failures are logged loudly so a payment can
  //    never disappear silently.
  const paymentShapes: Array<Record<string, unknown>> = [
    {
      league_id: leagueId,
      user_id: userId,
      entry_id: entryId ?? undefined,
      ticket_amount: ticketAmount,
      platform_fee_amount: serviceFee,
      total_paid: totalAmount,
      currency: CURRENCY,
      kushki_ticket_number: ticketNumber,
      status: "completed",
    },
    {
      league_id: leagueId,
      user_id: userId,
      entry_id: entryId ?? undefined,
      ticket_amount: ticketAmount,
      platform_fee_amount: serviceFee,
      total_paid: totalAmount,
      currency: CURRENCY,
      kushki_ticket_number: ticketNumber,
      status: "approved",
    },
    {
      user_id: userId,
      league_id: leagueId,
      amount: totalAmount,
      entry_fee: ticketAmount,
      service_fee: serviceFee,
      ticket: ticketNumber,
      status: "completed",
      provider: "kushki",
    },
    {
      user_id: userId,
      league_id: leagueId,
      amount: totalAmount,
      entry_fee: ticketAmount,
      service_fee: serviceFee,
      ticket: ticketNumber,
      status: "approved",
      provider: "kushki",
    },
  ];

  let paymentId: string | null = null;
  for (const shape of paymentShapes) {
    const id = await withRetry(async () => {
      const res = await supabaseAdmin
        .from("payments")
        .insert(shape)
        .select()
        .single();
      if (res.error) throw res.error;
      return res.data.id as string;
    });
    if (id) {
      paymentId = id;
      console.log(
        `[PAYMENT PERSISTED] payments.id=${id} ticket=${ticketNumber} shape=${Object.keys(shape).join(",")}`,
      );
      break;
    }
  }

  if (!paymentId) {
    // Never blocks the user (Step 43 guarantee) — but this MUST be loud so the
    // operator can see the exact Postgres/PostgREST error and reconcile.
    console.error(
      "[CRITICAL DB ERROR] Cargo aprobado por Kushki pero el pago NO se insertó en `payments` tras 4 intentos. El usuario no fue bloqueado (membership stageada); revisa los logs y usa `npm run reconcile:payments`.",
      { leagueId, userId, ticketNumber, totalAmount },
    );
  }

  // 3) Stage active membership in `league_participants` (best-effort).
  await withRetry(async () => {
    const res = await supabaseAdmin.from("league_participants").upsert(
      {
        league_id: leagueId,
        user_id: userId,
        payment_id: paymentId ?? undefined,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "league_id,user_id" },
    );
    if (res.error) throw res.error;
    return res;
  });

  // 4) Refresh the league's `bolsa_total` (best-effort; the canonical pot is
  //    still computed live from alive `entries` across all views).
  await withRetry(async () => {
    const { count } = await supabaseAdmin
      .from("entries")
      .select("*", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("status", "alive");
    const res = await supabaseAdmin
      .from("leagues")
      .update({ bolsa_total: Number(league.entry_fee ?? 0) * (count ?? 1) })
      .eq("id", leagueId);
    if (res.error) throw res.error;
    return res;
  });

  // 5) ALWAYS return success after Kushki approval — the user paid.
  return NextResponse.json(
    {
      success: true,
      message: "Pago completado con éxito",
      transactionId: ticketNumber,
      ticketNumber,
      entryId: entryId ?? undefined,
      paymentId: paymentId ?? undefined,
    },
    { status: 200 },
  );
}
