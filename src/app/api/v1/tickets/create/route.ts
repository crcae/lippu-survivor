import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/v1/tickets/create
 *
 * Mint a ticket token for a Lippu (Bubble.io) purchase. Called by the Lippu
 * backend when a user buys one or more entries, so the user can later redeem
 * them in-app.
 *
 * Body:
 * {
 *   ticketCode: string,     // e.g. "LIPPU-TK-12345"
 *   leagueId: string,       // target league uuid
 *   entriesCount?: number,  // how many entries the ticket grants (default 1)
 *   userEmail?: string      // purchaser's email, stored for reference
 * }
 */
export async function POST(request: Request) {
  let body: {
    ticketCode?: unknown;
    leagueId?: unknown;
    entriesCount?: unknown;
    userEmail?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido: se espera JSON." },
      { status: 400 },
    );
  }

  const ticketCode = typeof body.ticketCode === "string"
    ? body.ticketCode.trim().toUpperCase()
    : "";
  const leagueId = typeof body.leagueId === "string" ? body.leagueId.trim() : "";
  const userEmail =
    typeof body.userEmail === "string" ? body.userEmail.trim() : undefined;
  const rawEntries = Number(body.entriesCount ?? 1);

  if (!ticketCode || ticketCode.length < 6) {
    return NextResponse.json(
      { error: "ticketCode inválido. Usa un código de al menos 6 caracteres." },
      { status: 400 },
    );
  }
  if (!leagueId) {
    return NextResponse.json({ error: "leagueId es requerido." }, { status: 400 });
  }
  const entriesCount = Number.isInteger(rawEntries)
    ? Math.min(Math.max(rawEntries, 1), 20)
    : 1;

  const supabase = await createClient();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueError) {
    return NextResponse.json({ error: "Error consultando la liga." }, { status: 500 });
  }
  if (!league) {
    return NextResponse.json({ error: "La liga no existe." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ticket_tokens")
    .insert({
      code: ticketCode,
      league_id: leagueId,
      entries_count: entriesCount,
      user_email: userEmail ?? null,
      status: "available",
    })
    .select("id, code, league_id, entries_count, status")
    .single();
  if (error) {
    return NextResponse.json({ error: "No se pudo crear el ticket." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ticket: data }, { status: 201 });
}
