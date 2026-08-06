import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET/POST /api/payments/payout-details
 *
 * Reads or saves the league commissioner's bank details for payout.
 * Ownership is verified server-side against `leagues.owner_id` using the
 * service-role client, so this works for both authenticated users and local
 * guest commissioners (whose UUID is stored as `owner_id`). Bank data never
 * goes through guest-facing RLS.
 *
 * GET  ?leagueId=<uuid>&userId=<uuid>
 * POST { leagueId, userId, bankName?, clabe?, accountHolder? }
 */

const CLABE_LENGTH = 18;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueId = searchParams.get("leagueId") ?? "";
  const userId = searchParams.get("userId") ?? "";

  if (!isUuid(leagueId) || !isUuid(userId)) {
    return NextResponse.json(
      { error: "leagueId y userId son requeridos." },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof getAdminClient>;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Error de configuración del servidor." },
      { status: 500 },
    );
  }

  const { data: league } = await admin
    .from("leagues")
    .select("owner_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) {
    return NextResponse.json({ error: "La liga no existe." }, { status: 404 });
  }
  if (league.owner_id !== userId) {
    return NextResponse.json(
      { error: "No tienes permisos para ver estos datos." },
      { status: 403 },
    );
  }

  const { data, error } = await admin
    .from("commissioner_payout_details")
    .select("*")
    .eq("league_id", leagueId)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar tus datos de retiro." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bankName: data?.bank_name ?? "",
    clabe: data?.clabe ?? "",
    accountHolder: data?.account_holder ?? "",
  });
}

export async function POST(request: Request) {
  let body: {
    leagueId?: unknown;
    userId?: unknown;
    bankName?: unknown;
    clabe?: unknown;
    accountHolder?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido: se espera JSON." },
      { status: 400 },
    );
  }

  const leagueId = typeof body.leagueId === "string" ? body.leagueId.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const bankName =
    typeof body.bankName === "string" ? body.bankName.trim().slice(0, 60) : "";
  const clabe =
    typeof body.clabe === "string"
      ? body.clabe.replace(/\D/g, "").slice(0, CLABE_LENGTH)
      : "";
  const accountHolder =
    typeof body.accountHolder === "string"
      ? body.accountHolder.trim().slice(0, 80)
      : "";

  if (!isUuid(leagueId) || !isUuid(userId)) {
    return NextResponse.json(
      { error: "leagueId y userId son requeridos." },
      { status: 400 },
    );
  }
  if (clabe && clabe.length !== CLABE_LENGTH) {
    return NextResponse.json(
      { error: "La CLABE interbancaria debe tener 18 dígitos." },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof getAdminClient>;
  try {
    admin = getAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Error de configuración del servidor." },
      { status: 500 },
    );
  }

  const { data: league } = await admin
    .from("leagues")
    .select("owner_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (!league) {
    return NextResponse.json({ error: "La liga no existe." }, { status: 404 });
  }
  if (league.owner_id !== userId) {
    return NextResponse.json(
      { error: "No tienes permisos para guardar estos datos." },
      { status: 403 },
    );
  }

  const { error } = await admin.from("commissioner_payout_details").upsert(
    {
      league_id: leagueId,
      bank_name: bankName,
      clabe,
      account_holder: accountHolder,
    },
    { onConflict: "league_id" },
  );
  if (error) {
    return NextResponse.json(
      { error: "No se pudieron guardar tus datos de retiro." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
