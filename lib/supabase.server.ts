import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ── SSR server client (server components, route handlers) ───────────────────
// Reads/writes auth cookies from the Next.js cookie store.
// Import from this file — not lib/supabase.ts — in server-side code that
// needs to read the logged-in user from cookies.
export async function getAuthServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

// ── Session user (server components on protected routes) ─────────────────────
// Decodes the JWT from the cookie — no network call to Supabase.
// Safe to use in page components because middleware already verified the
// session with getUser() and redirected unauthenticated requests.
export async function getSessionUser() {
  const supabase = await getAuthServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
