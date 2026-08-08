import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/lib/notifications/admin-alert";

export const runtime = "nodejs";

/**
 * POST /api/admin/alerts
 *
 * Fire-and-forget admin notification endpoint for client-side events that
 * have no server action (e.g. league creation happens in the browser via
 * `createLeagueInDb`). The client sends the event DTO and this route forwards
 * it to the admin-alert helper (Resend e-mail to `contacto@lippu.app` and/or
 * `ADMIN_WEBHOOK_URL`). Always returns 200 quickly — delivery is best-effort.
 *
 * Body:
 * {
 *   type: "league-created",
 *   leagueId: string,      // new league id
 *   leagueName: string,
 *   mode: "paid" | "free",
 *   entryFee: number,
 *   creatorName?: string,
 *   creatorEmail?: string,
 *   inviteCode?: string
 * }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Body inválido." },
      { status: 400 },
    );
  }

  if (body.type === "league-created") {
    const leagueName =
      typeof body.leagueName === "string" ? body.leagueName : "Sin nombre";
    const mode = body.mode === "free" ? "Gratis" : "De Paga";
    const entryFee = Number(body.entryFee ?? 0);
    const creatorName =
      typeof body.creatorName === "string" && body.creatorName.trim()
        ? body.creatorName
        : "Desconocido";
    const creatorEmail =
      typeof body.creatorEmail === "string" && body.creatorEmail.trim()
        ? body.creatorEmail
        : "—";
    const inviteCode =
      typeof body.inviteCode === "string" ? body.inviteCode : "—";
    const leagueId =
      typeof body.leagueId === "string" ? body.leagueId : "";

    const text = [
      `Nueva liga creada en Lippu Survivor`,
      `————————————`,
      `Liga: ${leagueName}${leagueId ? ` (${leagueId})` : ""}`,
      `Modo: ${mode}`,
      `Costo por entrada: $${entryFee.toFixed(2)} MXN`,
      `Creador: ${creatorName} (${creatorEmail})`,
      inviteCode ? `Código de invitación: ${inviteCode}` : null,
      `Enlace: ${leagueId ? `https://survivor.lippu.app/join/${leagueId}?invite=${inviteCode || ""}` : "—"}`,
    ]
      .filter(Boolean)
      .join("\n");

    void sendAdminAlert({
      subject: `🛡️ Nueva liga ${mode.toLowerCase()}: ${leagueName}`,
      text,
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, message: "Tipo de alerta no soportado." },
    { status: 400 },
  );
}