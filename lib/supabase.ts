import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Browser client (client components) ──────────────────────────────────────
// Manages auth cookies automatically in the browser.
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Admin / service-role client ──────────────────────────────────────────────
// Bypasses RLS. Only use in server-side code (route handlers).
let _server: SupabaseClient | null = null;
export function getServerClient(): SupabaseClient {
  if (!_server) {
    _server = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _server;
}
