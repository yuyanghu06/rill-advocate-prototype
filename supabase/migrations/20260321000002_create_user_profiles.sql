-- User profiles table.
-- One row per authenticated user. Ranking score is recomputed on every
-- finalize call; display_name is optional (populated from auth metadata later).
create table user_profiles (
  user_id       uuid        primary key references auth.users (id) on delete cascade,
  display_name  text,
  ranking_score integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at current automatically.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();
