"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, Modal } from "@/components/ui";
import { APP_BASE_URL } from "@/lib/survivor-utils";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
}

type AuthMode = "signin" | "signup";
type LoadingState = "google" | "email" | null;

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

/**
 * Builds the `/auth/callback` URL for OAuth/email redirects, preserving a
 * `next` param so the user lands back where they were after the session code
 * is exchanged. Uses the canonical production origin as a server-side
 * fallback (never `localhost`).
 */
function authCallbackUrl(next: string): string {
  const base =
    typeof window !== "undefined" ? window.location.origin : APP_BASE_URL;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, supabase }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>(null);

  const reset = () => {
    setError(null);
    setInfo(null);
    setPassword("");
  };

  const handleClose = () => {
    setLoading(null);
    reset();
    onClose();
  };

  const handleGoogle = async () => {
    if (!supabase) {
      setError(
        "Supabase no está configurado en este entorno. Agrega las variables de entorno y vuelve a desplegar.",
      );
      return;
    }
    setError(null);
    setInfo(null);
    setLoading("google");
    try {
      // Send the user back to the OAuth provider, then land on /auth/callback
      // with the `next` param preserved so they return to the page they were on.
      const redirectUrl = authCallbackUrl(
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/",
      );
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (authError) setError(authError.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar con Google.",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase no está configurado en este entorno. Agrega las variables de entorno y vuelve a desplegar.",
      );
      return;
    }
    if (!email.trim() || password.length < 6) {
      setError("Ingresa un correo válido y una contraseña de al menos 6 caracteres.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setError("Ingresa tu nombre de jugador para crear tu cuenta.");
      return;
    }

    setError(null);
    setInfo(null);
    setLoading("email");

    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        handleClose();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: authCallbackUrl("/mis-ligas"),
          },
        });
        if (authError) {
          setError(authError.message);
          return;
        }
        if (!data.session) {
          setInfo(
            "Revisa tu bandeja de entrada y confirma tu correo para activar tu cuenta.",
          );
          reset();
          return;
        }
        // Best-effort: seed the `public.profiles` row with the chosen display
        // name so leaderboards/standings resolve it immediately. The AuthContext
        // listener also upserts on SIGNED_IN, so this is just a guarantee.
        if (data.user) {
          try {
            await supabase.from("profiles").upsert(
              {
                id: data.user.id,
                email: data.user.email,
                display_name: displayName.trim(),
                avatar_url: data.user.user_metadata?.avatar_url ?? null,
              },
              { onConflict: "id" },
            );
          } catch {
            // Never block signup because of a best-effort profile seed.
          }
        }
        handleClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ocurrió un error al iniciar sesión.",
      );
    } finally {
      setLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!supabase) return;
    if (!email.trim()) {
      setError("Ingresa tu correo para enviarte el enlace de recuperación.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading("email");
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: authCallbackUrl("/") },
      );
      if (authError) {
        setError(authError.message);
        return;
      }
      setInfo("Te enviamos un enlace para recuperar tu contraseña.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el enlace.",
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bienvenido a Lippu Survivor">
      {!supabase ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>
            Supabase no está configurado en este entorno. Agrega{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</span> y{" "}
            <span className="font-mono text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </span>{" "}
            para poder iniciar sesión.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={loading !== null}
            className="inline-flex items-center justify-center gap-2.5 w-full px-6 py-3 text-base rounded-xl bg-zinc-900 text-white font-semibold border border-zinc-700 hover:bg-zinc-800 hover:border-purple-500/50 cursor-pointer active:scale-[0.98] transition-all duration-150 focus-ring disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading === "google" ? (
              <>
                <span className="inline-block w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                Redirigiendo…
              </>
            ) : (
              <>
                <GoogleIcon />
                Continuar con Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-secondary">o usa tu correo</span>
            <span className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-display-name"
                  className="text-sm font-semibold text-text-primary"
                >
                  Nombre completo
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre visible en las ligas"
                  maxLength={40}
                  required
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-sm font-semibold text-text-primary">
                Correo electrónico
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  setInfo(null);
                }}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="text-sm font-semibold text-text-primary">
                  Contraseña
                </label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => void handleForgotPassword()}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                    setInfo(null);
                  }}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-danger bg-danger/10 border border-danger/40 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            {info && (
              <p className="flex items-start gap-2 text-sm text-success bg-success/10 border border-success/40 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                {info}
              </p>
            )}

            <Button
              variant="primary"
              size="lg"
              type="submit"
              className="w-full"
              isLoading={loading === "email"}
            >
              {mode === "signin" ? (
                <>
                  <Mail className="w-4 h-4" />
                  Iniciar Sesión
                </>
              ) : (
                "Crear Cuenta"
              )}
            </Button>
          </form>

          <div className="pt-1 border-t border-border">
            <p className="text-sm text-text-secondary text-center">
              {mode === "signin" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  reset();
                }}
                className="font-semibold text-accent hover:text-accent-hover transition-colors"
              >
                {mode === "signin" ? "Crea una gratis" : "Inicia sesión"}
              </button>
            </p>
            <p className="mt-3 text-[11px] text-text-secondary/80 text-center leading-relaxed">
              Al continuar aceptas los términos de la temporada 2026. Tu correo
              solo se usa para iniciar sesión y recuperar tu cuenta.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
