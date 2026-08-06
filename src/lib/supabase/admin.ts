import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client using the service role key. It bypasses Row
 * Level Security entirely, so it is ONLY meant for trusted backend work such
 * as syncing the NFL schedule and automatically evaluating weekly picks.
 *
 * Never use this on the client or expose the service role key to the browser.
 * Returns a cached singleton (the key never changes at runtime).
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missingVars: string[] = [];
    if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceRoleKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
    console.error("[supabase/admin] Faltan variables de entorno:", missingVars);
    throw new Error(
      `Error: Faltan las variables ${missingVars.join(
        ", ",
      )} en Vercel. Configúralas en el proyecto y vuelve a desplegar.`,
    );
  }

  adminClient = createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
