import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client. Prefers the service role key, which bypasses
 * Row Level Security entirely, so it is ONLY meant for trusted backend work
 * such as syncing the NFL schedule, automatically evaluating weekly picks and
 * persisting payment records. If `SUPABASE_SERVICE_ROLE_KEY` is missing it
 * falls back cleanly to `NEXT_PUBLIC_SUPABASE_ANON_KEY` (with a warning) so
 * the app never crashes during local development.
 *
 * Never use this on the client or expose the service role key to the browser.
 * Returns a cached singleton (the key never changes at runtime).
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error("[supabase/admin] Falta NEXT_PUBLIC_SUPABASE_URL");
    throw new Error(
      "Error: Falta NEXT_PUBLIC_SUPABASE_URL en Vercel. Configúrala en el proyecto y vuelve a desplegar.",
    );
  }

  // Prefer the service role key (bypasses RLS). If it is missing, fall back to
  // the anon key so the app keeps working locally — writes may then be subject
  // to RLS, which is why a loud warning is emitted.
  const key = serviceRoleKey ?? anonKey;
  if (!key) {
    const missingVars: string[] = [];
    if (!serviceRoleKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!anonKey) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("[supabase/admin] Faltan variables de entorno:", missingVars);
    throw new Error(
      `Error: Faltan las variables ${missingVars.join(
        ", ",
      )} en Vercel. Configúralas en el proyecto y vuelve a desplegar.`,
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      "[supabase/admin] SUPABASE_SERVICE_ROLE_KEY no está definido — usando NEXT_PUBLIC_SUPABASE_ANON_KEY. Las escrituras de pago pueden ser bloqueadas por RLS; configura la service role key en producción.",
    );
  }

  adminClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
