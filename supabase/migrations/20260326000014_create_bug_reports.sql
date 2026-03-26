-- ── Bug Reports ───────────────────────────────────────────────────────────────
-- Separate table for user-submitted bug reports with optional screenshot URLs.
-- Screenshots are stored in a dedicated Supabase Storage bucket (bug-screenshots)
-- and referenced here by public URL.

create table if not exists bug_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  user_email    text,
  title         text not null,
  description   text not null,
  page_url      text,
  screenshot_urls text[] not null default '{}',
  status        text not null default 'open'
                check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on row changes
create or replace function touch_bug_report_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bug_reports_updated_at
  before update on bug_reports
  for each row execute function touch_bug_report_updated_at();

-- Indexes
create index bug_reports_user_id_idx on bug_reports(user_id);
create index bug_reports_status_idx  on bug_reports(status);
create index bug_reports_created_at_idx on bug_reports(created_at desc);

-- RLS: users can insert and read their own reports; service role has full access
alter table bug_reports enable row level security;

create policy "users can insert own bug reports"
  on bug_reports for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can view own bug reports"
  on bug_reports for select
  to authenticated
  using (auth.uid() = user_id);

-- Storage bucket for screenshots (run once manually in Supabase dashboard
-- or via the Storage API if not already created):
--
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('bug-screenshots', 'bug-screenshots', false);
--
-- RLS for the bucket:
--   Allow authenticated users to upload to their own subfolder: user_id/*
--   Allow service role full access for admin review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bug-screenshots',
  'bug-screenshots',
  false,
  5242880,  -- 5 MB per file
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "authenticated users can upload screenshots"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bug-screenshots' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "authenticated users can read own screenshots"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bug-screenshots' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
