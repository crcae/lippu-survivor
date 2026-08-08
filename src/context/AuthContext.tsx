"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  getLocalGuestId,
  readLocalGuestId,
} from "@/lib/services/survivor-db";

export interface AuthProfile {
  id: string;
  email: string;
  displayName: string;
  /** Mirrors `public.profiles.display_name` (DB-authoritative display name). */
  display_name?: string;
  avatarUrl: string | null;
}

export interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  supabase: SupabaseClient | null;
  /** True when there is no real (Google/email) session — guest/demo mode. */
  isGuest: boolean;
  /** True when the user signed in with a real account (has an email). */
  isAuthenticated: boolean;
  /** Opens the global login/sign-up modal. */
  openAuth: () => void;
  /** Closes the global login/sign-up modal. */
  closeAuth: () => void;
  /** Whether the login modal is currently open. */
  authOpen: boolean;
  /** Signs out the current session (no-op when already a guest). */
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapUserToProfile(user: User): AuthProfile {
  const metadata = (user.user_metadata ?? {}) as {
    display_name?: string;
    avatar_url?: string | null;
  };

  const isGuest = user.is_anonymous === true || !user.email;
  const displayName =
    metadata.display_name ?? (isGuest ? "Guest" : user.email?.split("@")[0] ?? "Jugador");

  return {
    id: user.id,
    email: isGuest
      ? `anon_${user.id.replace(/-/g, "").slice(0, 12)}@lippu.app`
      : (user.email ?? ""),
    displayName,
    display_name: displayName,
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
  const [authOpen, setAuthOpen] = useState(false);
  const router = useRouter();

  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  /**
   * Signs out and immediately redirects to the landing page. Waits for the
   * Supabase sign-out (cookie/session cleanup) to finish before navigating so
   * the fresh page load never sees a half-cleared session.
   */
  const signOut = useCallback(() => {
    const done = () => {
      setUser(null);
      setProfile(null);
      router.push("/");
    };
    if (supabase) {
      void supabase.auth.signOut().finally(done);
    } else {
      done();
    }
  }, [supabase, router]);

  useEffect(() => {
    if (!supabase) return;

    let disposed = false;

    /**
     * Reads `public.profiles.display_name` (authoritative) and merges it into
     * the in-memory profile. Best-effort: on any failure the metadata-derived
     * name is kept, so auth flows never break because of a DB hiccup.
     */
    const applyDbProfile = async (base: AuthProfile) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", base.id)
          .maybeSingle();
        if (disposed) return;
        if (data?.display_name) {
          setProfile((prev) => {
            if (!prev || prev.id !== base.id) return prev;
            return {
              ...prev,
              displayName: data.display_name,
              display_name: data.display_name,
              avatarUrl: data.avatar_url ?? prev.avatarUrl,
            };
          });
        }
      } catch {
        // Best-effort read — the metadata-derived name is fine.
      }
    };

    const sync = (nextUser: User | null) => {
      if (disposed) return;
      setUser(nextUser);
      const nextProfile = nextUser ? mapUserToProfile(nextUser) : null;
      setProfile(nextProfile);
      if (nextProfile) void applyDbProfile(nextProfile);
    };

    const upsertProfile = async (nextProfile: AuthProfile) => {
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

    const localGuestProfile = (guestId: string): AuthProfile => ({
      id: guestId,
      email: `anon_${guestId.replace(/[^a-z0-9]/gi, "").slice(-12)}@lippu.app`,
      displayName: "Guest",
      avatarUrl: null,
    });

    const ensureGuest = async () => {
      // 1) Reuse an existing local guest profile (deterministic per device,
      //    same identity the service layer uses for league creation).
      const existingGuestId = readLocalGuestId();
      if (existingGuestId) {
        if (disposed) return;
        const guestProfile = localGuestProfile(existingGuestId);
        setProfile(guestProfile);
        void upsertProfile(guestProfile);
        void applyDbProfile(guestProfile);
        return;
      }

      // 2) Best-effort anonymous auth user (never blocks the guest flow).
      const { data, error } = await supabase.auth.signInAnonymously();
      if (disposed) return;
      if (!error && data.user) {
        sync(data.user);
        void upsertProfile(mapUserToProfile(data.user));
        return;
      }

      // 3) Fallback: anonymous sign-ins disabled → generate a local guest UUID
      //    persisted to localStorage so league creation never fails.
      const guestId = getLocalGuestId();
      if (disposed) return;
      const guestProfile = localGuestProfile(guestId);
      setProfile(guestProfile);
      void upsertProfile(guestProfile);
      void applyDbProfile(guestProfile);
    };

    supabase.auth.getUser().then(({ data }) => {
      if (disposed) return;
      if (data.user) {
        sync(data.user);
        void upsertProfile(mapUserToProfile(data.user));
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
      void upsertProfile(mapUserToProfile(nextUser));
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => {
    const isGuest =
      user === null || user.is_anonymous === true || !user.email;
    return {
      user,
      profile,
      loading,
      supabase,
      isGuest,
      isAuthenticated: !isGuest,
      openAuth,
      closeAuth,
      authOpen,
      signOut,
    };
  }, [user, profile, loading, supabase, openAuth, closeAuth, authOpen, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal isOpen={authOpen} onClose={closeAuth} supabase={supabase} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return context;
}
