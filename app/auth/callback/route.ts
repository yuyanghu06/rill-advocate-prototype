import { NextRequest, NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase.server";

/**
 * GET /auth/callback
 *
 * Handles the redirect from Supabase after email confirmation or OAuth.
 * Exchanges the one-time `code` for a persistent session, then sends the
 * user to their intended destination (defaults to /onboarding).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await getAuthServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
