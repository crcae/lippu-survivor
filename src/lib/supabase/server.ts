import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server-side Supabase client for App Router Server Components, Route
 * Handlers and Server Actions.
 *
 * Always create a fresh client per request — never cache it across requests.
 * Cookies are handled via the SSR `getAll`/`setAll` interface so that token
 * refreshes are persisted through the `setAll` handler.
 */
export async function createClient() {
  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars: string[] = [];
    if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("[supabase/server] Faltan variables de entorno:", missingVars);
    throw new Error(
      `Error: Faltan las variables ${missingVars.join(
        ", ",
      )} en Vercel. Configúralas en el proyecto y vuelve a desplegar.`,
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies cannot be written.
          // The middleware client refreshes the session on the next request.
        }
      },
    },
  });
}
