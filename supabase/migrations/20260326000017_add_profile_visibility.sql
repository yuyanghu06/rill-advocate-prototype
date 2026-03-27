-- Add is_visible flag to user_profiles.
-- When false, the user is excluded from Discover search results.
-- Defaults to true so existing users remain discoverable.

alter table user_profiles
  add column if not exists is_visible boolean not null default true;
