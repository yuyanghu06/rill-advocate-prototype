-- Add capability_bullets to user_profiles.
-- capability_bullets : 3-5 generalized "what this person can do" bullets,
-- regenerated after every experience block or skills change and displayed on
-- the profile page and recruiter candidate card.

alter table user_profiles
  add column if not exists capability_bullets text[] not null default '{}';
