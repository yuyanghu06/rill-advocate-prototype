-- Add fields used by the Discover page to user_profiles.
-- headline     : auto-generated one-line summary shown on the candidate card.
-- top_skills   : denormalised array of skill tags (updated on each finalize call).
-- helper_url_count : cached count of helper URLs across all blocks (used for ranking/filtering).

alter table user_profiles
  add column if not exists headline          text,
  add column if not exists top_skills        text[]  not null default '{}',
  add column if not exists helper_url_count  integer not null default 0;
