-- Experience blocks table.
-- Each row is one structured experience extracted during onboarding
-- (a job, project, contribution, etc.).
-- raw_embedding stores the 1536-dim OpenAI text-embedding-3-small vector.
create table experience_blocks (
  block_id       uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references user_profiles (user_id) on delete cascade,
  title          text        not null,
  overview       text        not null,
  embedded_text  text        not null,
  raw_embedding  vector(1536),
  source_type    text        not null check (source_type in ('resume', 'linkedin', 'github', 'other')),
  source_url     text        not null default '',
  helper_urls    text[]      not null default '{}',
  date_range     text,
  chunk_tree     jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Index for fast lookup of all blocks belonging to a user.
create index experience_blocks_user_id_idx
  on experience_blocks (user_id);

-- HNSW index for fast approximate cosine-similarity search.
-- Chosen over IVFFlat because it requires no training data and performs
-- well at MVP scale. m=16, ef_construction=64 are the pgvector defaults.
create index experience_blocks_embedding_hnsw_idx
  on experience_blocks
  using hnsw (raw_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Reuse the updated_at trigger defined in the user_profiles migration.
create trigger experience_blocks_updated_at
  before update on experience_blocks
  for each row execute function set_updated_at();
