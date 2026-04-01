-- Add avatar_url column to user_profiles.
-- The actual image files live in the 'avatars' Supabase Storage bucket.
-- Stored path convention: {user_id}/{filename}

alter table user_profiles
  add column if not exists avatar_url text;

-- ── Storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ── RLS policies for the avatars bucket ──────────────────────────────────────

-- Anyone can view avatars (bucket is public, but explicit select policy is good practice)
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Users can only upload into their own folder ({user_id}/*)
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can replace their own avatar
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatar
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
