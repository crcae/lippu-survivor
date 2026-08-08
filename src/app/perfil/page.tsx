"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  Loader2,
  LogOut,
  Save,
  Shield,
  Trophy,
  UserRound,
} from "lucide-react";
import { Button, Card, useToast } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  getCurrentUser,
  getUserCommissionedLeaguesInDb,
  getUserEnrolledLeaguesInDb,
} from "@/lib/services/survivor-db";
import { SEASON_YEAR } from "@/lib/mock-survivor-data";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-200";

export default function PerfilPage() {
  const { profile, isGuest, user, supabase, loading, openAuth, signOut } =
    useAuth();
  const { success, error: toastError } = useToast();

  const [displayName, setDisplayName] = useState(
    profile?.displayName ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    commissioned: 0,
  });

  // Keep the editor in sync when the authenticated profile changes (e.g. the
  // auth-state listener populates `profile` after mount, or a name is saved).
  const [lastSyncedName, setLastSyncedName] = useState(profile?.displayName ?? "");
  if (profile?.displayName !== lastSyncedName) {
    setLastSyncedName(profile?.displayName ?? "");
    setDisplayName(profile?.displayName ?? "");
  }

  // Load account stats (league counts) once the user is known.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(async (userInfo) => {
        if (!userInfo) return { total: 0, active: 0, commissioned: 0 };
        const [enrolled, commissioned] = await Promise.all([
          getUserEnrolledLeaguesInDb(userInfo.id),
          getUserCommissionedLeaguesInDb(userInfo.id),
        ]);
        const ids = new Set<string>();
        for (const league of [...enrolled, ...commissioned]) {
          ids.add(league.leagueId);
        }
        let active = 0;
        for (const league of [...enrolled, ...commissioned]) {
          if (league.leagueStatus === "active") active += 1;
        }
        return { total: ids.size, active, commissioned: commissioned.length };
      })
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats({ total: 0, active: 0, commissioned: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (name.length < 3) {
      toastError("Tu nombre debe tener al menos 3 caracteres.");
      return;
    }
    if (!supabase) {
      toastError("Supabase no está configurado en este entorno.");
      return;
    }
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: name },
      });
      if (authError) throw authError;
      // Keep the profiles table in sync in case the auth-state listener missed.
      await supabase.from("profiles").upsert(
        {
          id: user?.id,
          email: profile?.email,
          display_name: name,
          avatar_url: profile?.avatarUrl,
        },
        { onConflict: "id" },
      );
      success("Tu nombre se actualizó correctamente.");
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "No se pudo actualizar tu nombre.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="h-40 rounded-2xl bg-surface/60 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-accent font-medium">
          <UserRound className="w-4 h-4 text-primary" />
          Mi Perfil
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
          Mi Perfil
        </h1>

        {isGuest || !user ? (
          <Card variant="elevated" className="p-8 sm:p-10 text-center space-y-4">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-elevated border border-border mx-auto">
              <UserRound className="w-8 h-8 text-text-secondary" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                Inicia sesión para personalizar tu perfil
              </h2>
              <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
                Tu nombre visible, correo y estadísticas de la temporada{" "}
                {SEASON_YEAR} se guardan en tu cuenta.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={openAuth}>
              Iniciar Sesión
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        ) : (
          <>
            {/* Profile card */}
            <Card variant="elevated" className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-purple-600/30 shrink-0">
                  {(profile?.displayName?.[0] || "L").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                  <p className="text-xs uppercase tracking-wider text-text-secondary">
                    Nombre visible en las ligas
                  </p>
                  <form
                    onSubmit={handleSaveName}
                    className="mt-2 flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={40}
                      placeholder="Tu nombre"
                      className={`${inputClass} flex-1`}
                      autoComplete="name"
                    />
                    <Button
                      variant="primary"
                      type="submit"
                      isLoading={saving}
                      className="shrink-0"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Guardar
                    </Button>
                  </form>

                  <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary justify-center sm:justify-start">
                    <AtSign className="w-4 h-4 shrink-0" />
                    <span className="truncate">{profile?.email ?? ""}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <Card variant="elevated" className="p-6">
              <h2 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                Resumen de la Temporada {SEASON_YEAR}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-surface px-3 py-4 text-center">
                  <p className="text-2xl font-black text-text-primary tabular-nums">
                    {stats.active}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mt-1">
                    Ligas Activas
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-3 py-4 text-center">
                  <p className="text-2xl font-black text-warning tabular-nums">
                    {stats.commissioned}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mt-1">
                    Comisionado
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-3 py-4 text-center">
                  <p className="text-2xl font-black text-text-primary tabular-nums">
                    {stats.total}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mt-1">
                    Total
                  </p>
                </div>
              </div>
            </Card>

            {/* Account actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/mis-ligas" className="flex-1">
                <Button variant="secondary" className="w-full">
                  <Trophy className="w-4 h-4" />
                  Ver Mis Ligas
                </Button>
              </Link>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void signOut()}
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}