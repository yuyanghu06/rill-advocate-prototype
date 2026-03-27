-- Add recruiter role support to user_profiles.
--
-- is_recruiter: false = candidate (default), true = recruiter / hiring manager
-- company_name: optional company name for recruiter profiles
--
-- The handle_new_auth_user trigger is updated to read is_recruiter from
-- auth signup metadata so the flag is set at account creation time.

alter table user_profiles
  add column if not exists is_recruiter boolean not null default false,
  add column if not exists company_name text;

-- Update trigger to also persist is_recruiter from signup metadata.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, display_name, is_recruiter)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    coalesce((new.raw_user_meta_data->>'is_recruiter')::boolean, false)
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name
    where excluded.display_name is not null;
  return new;
end;
$$;
