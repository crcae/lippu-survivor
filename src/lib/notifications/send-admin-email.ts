import nodemailer from "nodemailer";
import { sendAdminAlert } from "@/lib/notifications/admin-alert";

/**
 * Admin notification helper — fire-and-forget emails to `contacto@lippu.app`.
 *
 * Delivery always happens asynchronously and NEVER blocks or throws for the
 * caller, so payments and league creation keep working even when every mail
 * channel is down. The name is non-blocking on purpose: use `void
 * sendAdminEmail(...)`.
 *
 * Channel resolution:
 *   1. SMTP via `nodemailer` when `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` /
 *      `SMTP_PASS` are configured (production relay).
 *   2. Legacy Resend / webhook pipeline (`admin-alert.ts`) when `RESEND_API_KEY`
 *      / `ADMIN_WEBHOOK_URL` are set.
 *   3. Fallback: a `console` warning of the skipped alert (never a crash).
 */

export const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL ?? "contacto@lippu.app";

export interface AdminEmailOptions {
  subject: string;
  text: string;
}

const hasSmtpConfig = (): boolean =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS,
  );

async function deliverViaSmtp(message: AdminEmailOptions): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? "false") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ?? "Lippu Survivor <admin@lippu.app>",
      to: ADMIN_NOTIFY_EMAIL,
      subject: message.subject,
      text: message.text,
    });
    console.log(`[send-admin-email] Email SMTP enviado: ${message.subject}`);
    return true;
  } catch (err) {
    console.warn(
      "[send-admin-email] SMTP falló, probando canal de respaldo:",
      err,
    );
    return false;
  }
}

/**
 * Sends an admin alert. Non-blocking, never throws. Defaults to logging only
 * when no SMTP/Resend configuration exists so zero-key deployments still work.
 */
export async function sendAdminEmail(
  message: AdminEmailOptions,
): Promise<void> {
  try {
    if (hasSmtpConfig()) {
      const delivered = await deliverViaSmtp(message);
      if (delivered) return;
    }
    // Zero-key or SMTP-unreachable → fall back to the Resend/webhook pipeline
    // (which itself degrades to a log when no keys are set). Never throws.
    await sendAdminAlert({ subject: message.subject, text: message.text });
  } catch (err) {
    console.error("[send-admin-email] Email alert skipped:", err);
  }
}