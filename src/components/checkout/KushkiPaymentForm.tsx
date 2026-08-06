"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { formatMxn } from "@/lib/survivor-utils";

/**
 * Kushki card checkout for paid league entries. Renders the card form, the
 * Apple Pay button (visual — only shown where `ApplePaySession` is available on
 * a secure origin; the charge goes through the card token flow) and the
 * success/error status screens. Card data is tokenized on-device by the Kushki
 * SDK and only the token is sent to `/api/payments/kushki/charge`.
 */

const KUSHKI_PUBLIC_MERCHANT_ID = "8b4407dc16954e949b77384573dd86b7";
const KUSHKI_SDK_URL = "https://cdn.kushkipagos.com/kushki.min.js";

interface KushkiTokenResponse {
  code?: string | null;
  message?: string;
  token?: string;
  error?: string;
}

interface KushkiCard {
  name: string;
  number: string;
  cvc: string;
  expiryMonth: string;
  expiryYear: string;
}

interface KushkiInstance {
  requestToken: (
    options: {
      amount: string;
      currency: string;
      card: KushkiCard;
    },
    callback: (response: KushkiTokenResponse) => void,
  ) => void;
}

declare global {
  interface Window {
    Kushki?: new (
      merchantId: string,
      options: { inTestEnvironment: boolean },
    ) => KushkiInstance;
    ApplePaySession?: {
      supportsVersion: (version: number) => boolean;
    };
  }
}

let kushkiScriptPromise: Promise<boolean> | null = null;

function loadKushkiScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Kushki) {
    return Promise.resolve(true);
  }
  if (kushkiScriptPromise) return kushkiScriptPromise;

  kushkiScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = KUSHKI_SDK_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Kushki));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return kushkiScriptPromise;
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCvc(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

interface KushkiPaymentFormProps {
  leagueId: string;
  leagueName: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  entryName?: string;
  ticketAmount: number;
  platformFee: number;
  totalAmount: number;
  onSuccess?: (result: { ticketNumber: string; entryId: string }) => void;
}

type FormStatus = "idle" | "success" | "error";

export function KushkiPaymentForm({
  leagueId,
  leagueName,
  userId,
  userEmail,
  userName,
  entryName,
  ticketAmount,
  platformFee,
  totalAmount,
  onSuccess,
}: KushkiPaymentFormProps) {
  const { info } = useToast();

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holderName, setHolderName] = useState("");
  const [sdkReady, setSdkReady] = useState<boolean | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadKushkiScript().then((ok) => {
      if (!cancelled) setSdkReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Apple Pay only works on Safari with a supported ApplePaySession on a secure
  // origin. When unavailable the button is hidden entirely instead of showing a
  // dead control (card checkout stays the primary path).
  useEffect(() => {
    const check = setTimeout(() => {
      setApplePayAvailable(
        typeof window !== "undefined" &&
          typeof window.ApplePaySession === "function" &&
          window.isSecureContext === true,
      );
    }, 0);
    return () => clearTimeout(check);
  }, []);

  const validate = (): string | null => {
    const numberDigits = cardNumber.replace(/\s/g, "");
    if (numberDigits.length < 15) return "Ingresa un número de tarjeta válido.";
    if (holderName.trim().length < 2) return "Ingresa el nombre del titular.";
    if (cvc.length < 3) return "Ingresa el CVC de tu tarjeta.";

    const [month, year2] = expiry.split("/");
    const monthNum = Number(month);
    const yearNum = Number(year2);
    if (!month || !year2 || monthNum < 1 || monthNum > 12 || yearNum < 0) {
      return "Ingresa una fecha de vencimiento válida (MM/AA).";
    }
    const now = new Date();
    const currentYear = Number(String(now.getFullYear()).slice(-2));
    const currentMonth = now.getMonth() + 1;
    if (
      yearNum < currentYear ||
      (yearNum === currentYear && monthNum < currentMonth)
    ) {
      return "Tu tarjeta está vencida.";
    }
    return null;
  };

  const resetToIdle = () => {
    setStatus("idle");
    setMessage("");
    setProcessing(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (processing) return;

    const validationError = validate();
    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      return;
    }

    setProcessing(true);
    setStatus("idle");
    setMessage("");

    try {
      const ready = sdkReady === null ? await loadKushkiScript() : sdkReady;
      if (!ready || !window.Kushki) {
        throw new Error("No se pudo cargar el módulo de pago seguro.");
      }

      const kushki = new window.Kushki(KUSHKI_PUBLIC_MERCHANT_ID, {
        inTestEnvironment: false,
      });
      const [month, year2] = expiry.split("/");
      const totalCentavos = String(Math.round(totalAmount * 100));

      kushki.requestToken(
        {
          amount: totalCentavos,
          currency: "MXN",
          card: {
            name: holderName.trim(),
            number: cardNumber.replace(/\s/g, ""),
            cvc,
            expiryMonth: month,
            expiryYear: year2,
          },
        },
        async (response) => {
          if (response.code || !response.token) {
            setProcessing(false);
            setStatus("error");
            setMessage(
              response.message ??
                response.error ??
                "No se pudo validar tu tarjeta. Intenta de nuevo.",
            );
            return;
          }

          try {
            const res = await fetch("/api/payments/kushki/charge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: response.token,
                leagueId,
                userId,
                userEmail,
                userName,
                entryName,
              }),
            });
            const data = await res.json();
            setProcessing(false);

            if (data?.success) {
              setTicketNumber(data.ticketNumber ?? null);
              setStatus("success");
              onSuccess?.({
                ticketNumber: data.ticketNumber ?? "",
                entryId: data.entryId ?? "",
              });
            } else {
              setStatus("error");
              setMessage(
                data?.message ??
                  "Tu pago no fue aprobado. Intenta de nuevo.",
              );
            }
          } catch {
            setProcessing(false);
            setStatus("error");
            setMessage(
              "Ocurrió un error al procesar tu pago. Intenta de nuevo.",
            );
          }
        },
      );
    } catch (err) {
      setProcessing(false);
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al procesar tu pago. Intenta de nuevo.",
      );
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <div className="w-16 h-16 rounded-full bg-success/10 border border-success/40 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-text-primary">
            ¡Pago aprobado!
          </h3>
          <p className="text-sm text-text-secondary">
            Tu entrada a <span className="font-semibold">{leagueName}</span>{" "}
            está confirmada.
          </p>
          {ticketNumber && (
            <p className="text-xs text-text-secondary/70 pt-1">
              Referencia: <span className="tabular-nums">{ticketNumber}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-text-secondary animate-pulse">
          Redirigiendo a tu liga…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/40 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-text-primary">
            No se pudo completar el pago
          </h3>
          <p className="text-sm text-text-secondary">{message}</p>
        </div>
        <Button variant="primary" onClick={resetToIdle} className="w-full">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-5">
      {/* Loading overlay */}
      {processing && (
        <div className="absolute inset-0 z-10 bg-surface-elevated/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-text-primary">
            Procesando tu pago…
          </p>
          <p className="text-xs text-text-secondary">
            No cierres esta ventana
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-border bg-surface divide-y divide-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-text-secondary">
            Entrada a la bolsa
          </span>
          <span className="text-sm font-semibold text-text-primary tabular-nums">
            {formatMxn(ticketAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-text-secondary">Fee de servicio</span>
          <span className="text-sm font-semibold text-warning tabular-nums">
            {formatMxn(platformFee)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10">
          <span className="text-sm font-semibold text-text-primary">Total</span>
          <span className="text-base font-bold text-accent tabular-nums">
            {formatMxn(totalAmount)}
          </span>
        </div>
      </div>

      {/* Apple Pay (visual, only on supported browsers/secure origins) */}
      {applePayAvailable && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() =>
              info("Apple Pay estará disponible próximamente. Usa tu tarjeta.")
            }
            className="w-full h-11 rounded-xl bg-black text-white flex items-center justify-center gap-2 font-semibold text-base hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
            </svg>
            Apple Pay
          </button>
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-secondary">o paga con tarjeta</span>
            <span className="flex-1 h-px bg-border" />
          </div>
        </div>
      )}

      {/* Card fields */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="kushki-card-number"
            className="text-sm font-semibold text-text-primary"
          >
            Número de tarjeta
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              id="kushki-card-number"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="1234 5678 9012 3456"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="kushki-expiry"
              className="text-sm font-semibold text-text-primary"
            >
              Vencimiento
            </label>
            <input
              id="kushki-expiry"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/AA"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="kushki-cvc"
              className="text-sm font-semibold text-text-primary"
            >
              CVC
            </label>
            <input
              id="kushki-cvc"
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvc}
              onChange={(e) => setCvc(formatCvc(e.target.value))}
              placeholder="123"
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="kushki-holder"
            className="text-sm font-semibold text-text-primary"
          >
            Nombre del titular
          </label>
          <input
            id="kushki-holder"
            type="text"
            autoComplete="cc-name"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="Nombre como aparece en la tarjeta"
            className={inputClass}
          />
        </div>
      </div>

      {!sdkReady && sdkReady !== null && (
        <p className="text-xs text-danger">
          No se pudo cargar el módulo de pago seguro. Verifica tu conexión.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
        <p className="text-xs text-text-secondary">
          Tus datos se cifran y procesan con{" "}
          <span className="font-semibold">Kushki</span>. Lippu nunca guarda tu
          número de tarjeta.
        </p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        isLoading={processing}
        disabled={processing}
      >
        Pagar {formatMxn(totalAmount)}
      </Button>

      <div className="flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-success" />
        <p className="text-[11px] text-text-secondary/70">
          Pago procesado de forma segura por Kushki
        </p>
      </div>
    </form>
  );
}
