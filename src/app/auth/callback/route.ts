import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Supabase OAuth + email confirmation landing route. Exchanges the `code`
 * returned by the provider for a session cookie, then redirects back to the
 * page the user was viewing (`?next=`) or `/my-leagues` by default.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/my-leagues";
  const fallback = "/my-leagues";

  const safeNext = next.startsWith("/") ? next : fallback;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      console.error("[auth/callback] code exchange failed:", error?.message);
    } catch (err) {
      console.error(
        "[auth/callback] exchange error:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Missing/invalid code → send the user somewhere safe to re-authenticate.
  return NextResponse.redirect(`${origin}${fallback}`);
}
