"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Gate for protected actions (create/join league, make pick, pay).
 *
 * Returns a function that the caller should run at the top of the action
 * handler. When the user is still loading or already signed in it returns
 * `true` (proceed); when the user is a guest it opens the global login modal
 * and returns `false` (abort). Every gated handler must short-circuit on
 * `false` before doing any work.
 */
export function useAuthGate() {
  const { isGuest, loading, openAuth } = useAuth();

  return useCallback((): boolean => {
    if (!loading && isGuest) {
      openAuth();
      return false;
    }
    return true;
  }, [isGuest, loading, openAuth]);
}
