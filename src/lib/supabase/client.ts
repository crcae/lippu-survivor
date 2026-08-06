"use client";

import { createBrowserClient } from "@supabase/ssr";

export interface SupabaseEnv {
  url: string;
  anonKey: string;
  missingVars: string[];
}

/**
 * Reads the public Supabase env vars and reports which ones are missing.
 * `NEXT_PUBLIC_*` vars are inlined at build time, so on Vercel a missing
 * project env var shows up here as an empty string at runtime.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const missingVars: string[] = [];
  if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { url, anonKey, missingVars };
}

/**
 * Browser-side Supabase client.
 *
 * Use inside client components/hooks. Reads the public env vars
 * `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 *
 * Throws a descriptive error naming exactly which env vars are missing so the
 * caller can surface it verbatim in the UI (toast/console).
 */
export function createClient() {
  const { url, anonKey, missingVars } = getSupabaseEnv();

  if (missingVars.length > 0) {
    throw new Error(
      `Error: Faltan las variables ${missingVars.join(
        ", ",
      )} en Vercel. Configúralas en el proyecto y vuelve a desplegar.`,
    );
  }

  return createBrowserClient(url, anonKey);
}
