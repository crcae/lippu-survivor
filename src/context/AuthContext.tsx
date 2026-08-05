"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  supabase: SupabaseClient | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapUserToProfile(user: User): AuthProfile {
  const metadata = (user.user_metadata ?? {}) as {
    display_name?: string;
    avatar_url?: string | null;
  };

  const isGuest = user.is_anonymous === true || !user.email;

  return {
    id: user.id,
    email: isGuest
      ? `anon_${user.id.replace(/-/g, "").slice(0, 12)}@lippu.app`
      : (user.email ?? ""),
    displayName: metadata.display_name ?? (isGuest ? "Guest" : user.email?.split("@")[0] ?? "Jugador"),
    avatarUrl: metadata.avatar_url ?? null,
  };
}

function createBrowserClient(): SupabaseClient | null {
  try {
    return createClient();
  } catch {
    // Env vars missing — run as guest (demo mode).
    return null;
  }
}

/**
 * Synchronizes the current Supabase session with React state and keeps the
 * `profiles` table in sync with the authenticated user.
 *
 * When the Supabase env vars are missing (demo builds), the provider still
 * renders so the rest of the app (mock league) keeps working as a guest.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState<SupabaseClient | null>(createBrowserClient);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(() => supabase !== null);

  useEffect(() => {
    if (!supabase) return;

    let disposed = false;

    const sync = (nextUser: User | null) => {
      if (disposed) return;
      setUser(nextUser);
      setProfile(nextUser ? mapUserToProfile(nextUser) : null);
    };

    const upsertProfile = async (nextUser: User) => {
      const nextProfile = mapUserToProfile(nextUser);
      try {
        await supabase.from("profiles").upsert(
          {
            id: nextProfile.id,
            email: nextProfile.email,
            display_name: nextProfile.displayName,
            avatar_url: nextProfile.avatarUrl,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      } catch {
        // Profile write is best-effort; auth state is the source of truth.
      }
    };

    const ensureGuest = async () => {
      // No session → create an anonymous auth user so every league, entry and
      // pick persists. Requires "anonymous sign-ins" in the Supabase project.
      const { data, error } = await supabase.auth.signInAnonymously();
      if (disposed) return;
      if (!error && data.user) {
        sync(data.user);
        void upsertProfile(data.user);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      if (disposed) return;
      if (data.user) {
        sync(data.user);
        void upsertProfile(data.user);
      } else {
        void ensureGuest();
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      sync(nextUser);
      setLoading(false);

      if (!nextUser) return;
      void upsertProfile(nextUser);
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(
    () => ({ user, profile, loading, supabase }),
    [user, profile, loading, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return context;
}
