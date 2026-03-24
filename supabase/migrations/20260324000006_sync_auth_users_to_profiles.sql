-- Automatically create a user_profiles row whenever a new user is inserted
-- into auth.users (covers email/password signup, OAuth, magic link, etc.).
--
-- Uses SECURITY DEFINER so the function runs as the table owner and can
-- write to public.user_profiles regardless of the calling role's RLS context.

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_auth_user();
