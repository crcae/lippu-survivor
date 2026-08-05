import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * POST /api/v1/tickets/redeem
 *
 * Redeem a ticket token and create the buyer's entries in the league.
 * Called by the Lippu Survivor frontend after a purchase (`/league/join?ticket=CODE`)
 * or by Lippu (Bubble.io) on the user's behalf.
 *
 * Body:
 * {
 *   ticketCode: string,  // e.g. "LIPPU-TK-12345"
 *   userId: string       // Supabase auth uid that owns the new entries
 * }
 */
export async function POST(request: Request) {
  let body: {
    ticketCode?: unknown;
    userId?: unknown;
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
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!ticketCode) {
    return NextResponse.json(
      { error: "ticketCode es requerido." },
      { status: 400 },
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "userId es requerido." }, { status: 400 });
  }

  const supabase = await createClient();

  // Ensure the user has a profile row (covers guest/anonymous sessions).
  const { data: profileUser } = await supabase.auth.getUser();
  if (profileUser.user?.id === userId) {
    await supabase.from("profiles").upsert(
      {
        id: userId,
        email: profileUser.user.email ?? `anon_${userId.replace(/-/g, "").slice(0, 12)}@lippu.app`,
        display_name: "Jugador",
        avatar_url: null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  const { data: token, error: tokenError } = await supabase
    .from("ticket_tokens")
    .select("*")
    .eq("code", ticketCode)
    .maybeSingle();
  if (tokenError) {
    return NextResponse.json({ error: "Error consultando el ticket." }, { status: 500 });
  }
  if (!token) {
    return NextResponse.json(
      { error: "No encontramos un ticket con ese código." },
      { status: 404 },
    );
  }
  if (token.status !== "available") {
    return NextResponse.json(
      { error: "Este ticket ya fue canjeado." },
      { status: 409 },
    );
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name, capacity")
    .eq("id", token.league_id)
    .maybeSingle();
  if (leagueError) {
    return NextResponse.json({ error: "Error consultando la liga." }, { status: 500 });
  }
  if (!league) {
    return NextResponse.json(
      { error: "La liga asociada a este ticket ya no existe." },
      { status: 404 },
    );
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
    return NextResponse.json({ error: "Esta liga ya está llena." }, { status: 409 });
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
    if (entryError) {
      return NextResponse.json(
        { error: "No se pudieron crear tus entradas." },
        { status: 500 },
      );
    }
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
  if (redeemError) {
    return NextResponse.json(
      { error: "El ticket se canjeó pero no se pudo marcar como usado." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    leagueId: token.league_id,
    leagueName: league.name,
    entryIds,
    entriesCount: entryIds.length,
  });
}
