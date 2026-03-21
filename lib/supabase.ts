import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singletons — clients are created on first use, not at module load,
// so the build succeeds without env vars present.

let _browser: SupabaseClient | null = null;
let _server: SupabaseClient | null = null;

// Browser client — uses anon key, respects RLS.
export function getBrowserClient(): SupabaseClient {
  if (!_browser) {
    _browser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _browser;
}

// Server client — uses service role key, bypasses RLS.
// Only call this from server-side code (route handlers, server components).
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
