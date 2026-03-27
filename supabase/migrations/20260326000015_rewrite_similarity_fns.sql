-- Rewrite both similarity search functions to the standard Supabase pattern:
--   • Parameter order: query_embedding, match_threshold, match_count
--   • WHERE clause uses distance directly:  embedding <=> query_embedding < 1 - match_threshold
--     (equivalent to the old:  1 - (embedding <=> query_embedding) > similarity_threshold)
--   • Safety cap via least(match_count, 200)
--   • Explicit vector schema: vector(1536)

-- ── Global recruiter search ───────────────────────────────────────────────────
-- Drop old signature (query_embedding vector, match_count int, similarity_threshold float)
drop function if exists match_experience_blocks(vector, int, float);

create or replace function match_experience_blocks(
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int
)
returns table (
  block_id      uuid,
  user_id       uuid,
  title         text,
  source_type   text,
  source_url    text,
  helper_urls   text[],
  date_range    text,
  embedded_text text,
  chunk_tree    jsonb,
  similarity    float
)
language sql stable security definer as $$
  select
    eb.block_id,
    eb.user_id,
    eb.title,
    eb.source_type,
    eb.source_url,
    eb.helper_urls,
    eb.date_range,
    eb.embedded_text,
    eb.chunk_tree,
    1 - (eb.raw_embedding <=> query_embedding) as similarity
  from experience_blocks eb
  where
    eb.raw_embedding is not null
    and eb.raw_embedding <=> query_embedding < 1 - match_threshold
  order by eb.raw_embedding <=> query_embedding asc
  limit least(match_count, 200);
$$;

-- ── User-scoped search (Advocate chat) ───────────────────────────────────────
-- Drop old signature (p_user_id uuid, query_embedding vector, match_count int)
drop function if exists match_user_experience_blocks(uuid, vector, int);

create or replace function match_user_experience_blocks(
  p_user_id        uuid,
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int
)
returns table (
  block_id      uuid,
  title         text,
  source_url    text,
  helper_urls   text[],
  embedded_text text,
  chunk_tree    jsonb,
  similarity    float
)
language sql stable security definer set search_path = public as $$
  select
    eb.block_id,
    eb.title,
    eb.source_url,
    eb.helper_urls,
    eb.embedded_text,
    eb.chunk_tree,
    1 - (eb.raw_embedding <=> query_embedding) as similarity
  from experience_blocks eb
  where
    eb.user_id = p_user_id
    and eb.raw_embedding is not null
    and eb.raw_embedding <=> query_embedding < 1 - match_threshold
  order by eb.raw_embedding <=> query_embedding asc
  limit least(match_count, 200);
$$;
