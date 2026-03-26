-- Update the new-user trigger to also write display_name from auth metadata.
-- When a user signs up with a full_name in raw_user_meta_data, it is written
-- directly into user_profiles.display_name so no separate profile API call
-- is needed after confirmation.
--
-- The DO UPDATE clause only overwrites an existing display_name if the
-- incoming value is non-null, so OAuth-created profiles that already have a
-- display_name are not clobbered on re-insert.

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'full_name'), '')
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name
    where excluded.display_name is not null;
  return new;
end;
$$;
