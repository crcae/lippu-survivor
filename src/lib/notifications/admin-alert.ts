/**
 * Admin activity alerts — fire-and-forget notifications for operational
 * events (payments, league creations). Dispatches to two optional channels
 * without ever blocking the caller:
 *
 *   1. E-mail via Resend (when `RESEND_API_KEY` is set) → `contacto@lippu.app`.
 *   2. Discord/Telegram-style webhook (when `ADMIN_WEBHOOK_URL` is set).
 *
 * Every channel is best-effort: failures are logged and swallowed so the
 * payment / league-creation response loop is never delayed or broken.
 */

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? "contacto@lippu.app";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface AdminAlertMessage {
  subject: string;
  text: string;
}

/**
 * Sends an admin alert. Resolves immediately (non-blocking) and never throws.
 * Callers should use `void sendAdminAlert(...)` to stay fire-and-forget.
 */
export async function sendAdminAlert(
  message: AdminAlertMessage,
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL;

  if (!resendKey && !webhookUrl) {
    console.warn(
      "[admin-alert] Alert NO enviada: faltan RESEND_API_KEY / ADMIN_WEBHOOK_URL. Mensaje:",
      message.subject,
    );
    return;
  }

  await Promise.allSettled([
    resendKey ? deliverResend(resendKey, message) : Promise.resolve(),
    webhookUrl ? deliverWebhook(webhookUrl, message) : Promise.resolve(),
  ]);
}

async function deliverResend(
  apiKey: string,
  message: AdminAlertMessage,
): Promise<void> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Lippu Survivor <admin@lippu.app>",
        to: [ADMIN_EMAIL],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!res.ok) {
      console.error(
        `[admin-alert] Resend falló (${res.status}):`,
        await res.text().catch(() => ""),
      );
    } else {
      console.log(`[admin-alert] Email enviado: ${message.subject}`);
    }
  } catch (err) {
    console.error("[admin-alert] Error enviando email:", err);
  }
}

async function deliverWebhook(
  url: string,
  message: AdminAlertMessage,
): Promise<void> {
  try {
    const payload = {
      content: `**${message.subject}**\n${message.text}`,
      username: "Lippu Survivor Alert",
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(
        `[admin-alert] Webhook falló (${res.status}):`,
        await res.text().catch(() => ""),
      );
    } else {
      console.log("[admin-alert] Webhook enviado.");
    }
  } catch (err) {
    console.error("[admin-alert] Error enviando webhook:", err);
  }
}