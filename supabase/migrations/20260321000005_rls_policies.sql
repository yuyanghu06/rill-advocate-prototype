-- Row-Level Security policies for user_profiles and experience_blocks.
--
-- Principle:
--   - Users can read and update only their own rows.
--   - Insert is handled exclusively by the service-role key (server-side) —
--     no direct client inserts allowed.
--   - Recruiter search runs via the match_experience_blocks() SECURITY DEFINER
--     function, so experience_blocks does NOT need a public SELECT policy.
--   - The service-role key bypasses RLS entirely, so all server-side
--     route handlers use supabaseServer (service role).

-- ── user_profiles ──────────────────────────────────────────────────────────

alter table user_profiles enable row level security;

-- Users may read their own profile.
create policy "users can read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

-- Users may update their own profile (e.g. display_name).
create policy "users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── experience_blocks ───────────────────────────────────────────────────────

alter table experience_blocks enable row level security;

-- Users may read their own blocks (e.g. to render /profile/[userId]).
create policy "users can read own blocks"
  on experience_blocks for select
  using (auth.uid() = user_id);

-- Users may update their own blocks (e.g. editing an overview in the UI).
create policy "users can update own blocks"
  on experience_blocks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users may delete their own blocks.
create policy "users can delete own blocks"
  on experience_blocks for delete
  using (auth.uid() = user_id);

-- Note: INSERT and bulk upsert are intentionally omitted from RLS policies.
-- All writes go through supabaseServer (service role), which bypasses RLS.
