-- Auto-sync helper_url_count and top_skills on user_profiles.
--
-- helper_url_count
--   Source of truth: experience_blocks.helper_urls (text[]) per user.
--   Recomputed via an AFTER trigger on experience_blocks for every
--   INSERT / UPDATE / DELETE that touches a user's blocks.
--
-- top_skills
--   Source of truth: user_profiles.skills JSONB ({ "skill": score }).
--   Recomputed via a BEFORE trigger on user_profiles whenever the skills
--   column is written, so the array is always the ordered keys of that map.

-- ─── helper_url_count ─────────────────────────────────────────────────────────

create or replace function recompute_helper_url_count(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update user_profiles
  set helper_url_count = (
    select coalesce(sum(cardinality(helper_urls)), 0)
    from   experience_blocks
    where  user_id = p_user_id
  )
  where user_id = p_user_id;
$$;

create or replace function trg_sync_helper_url_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_helper_url_count(old.user_id);
  elsif tg_op = 'INSERT' then
    perform recompute_helper_url_count(new.user_id);
  else -- UPDATE
    perform recompute_helper_url_count(new.user_id);
    -- handle the (rare) case where a block is re-assigned to another user
    if old.user_id <> new.user_id then
      perform recompute_helper_url_count(old.user_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger experience_blocks_sync_helper_url_count
  after insert or update or delete
  on experience_blocks
  for each row
  execute function trg_sync_helper_url_count();

-- ─── top_skills ───────────────────────────────────────────────────────────────

create or replace function trg_sync_top_skills()
returns trigger
language plpgsql
as $$
begin
  -- Derive the ordered skill-name array from the skills JSONB map.
  -- Rows are sorted by score (value) descending so the strongest skills
  -- come first; ties are broken alphabetically for stability.
  new.top_skills = array(
    select key
    from   jsonb_each_text(coalesce(new.skills, '{}'::jsonb))
    order  by value::int desc, key asc
    limit  10
  );
  return new;
end;
$$;

create trigger user_profiles_sync_top_skills
  before insert or update of skills
  on user_profiles
  for each row
  execute function trg_sync_top_skills();

-- ─── Back-fill existing rows ──────────────────────────────────────────────────
-- Run both computations against whatever data already exists so the columns
-- are immediately consistent after this migration is applied.

update user_profiles up
set helper_url_count = (
  select coalesce(sum(cardinality(eb.helper_urls)), 0)
  from   experience_blocks eb
  where  eb.user_id = up.user_id
);

update user_profiles
set skills = skills;   -- triggers trg_sync_top_skills for every row
