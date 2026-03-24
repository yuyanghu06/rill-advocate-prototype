-- Add a skills column to user_profiles.
-- Stored as JSONB: { "skill name": score } where score is an integer 1–5.
-- Default is an empty object so existing rows are valid immediately.

alter table user_profiles
  add column skills jsonb not null default '{}'::jsonb;
