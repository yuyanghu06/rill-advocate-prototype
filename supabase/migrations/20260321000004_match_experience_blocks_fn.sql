-- Semantic similarity search function called by POST /api/search.
--
-- Uses cosine distance (<=>). Returns blocks whose similarity exceeds
-- similarity_threshold, ordered by descending similarity.
--
-- SECURITY DEFINER lets the anon/authenticated role call this function
-- while the underlying table read runs as the function owner (postgres),
-- bypassing RLS on experience_blocks for recruiter queries.
-- The function itself is the security boundary — it exposes no PII beyond
-- what is explicitly selected.
create or replace function match_experience_blocks(
  query_embedding    vector(1536),
  match_count        int     default 20,
  similarity_threshold float  default 0.35
)
returns table (
  block_id      uuid,
  user_id       uuid,
  title         text,
  overview      text,
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
    eb.overview,
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
    and 1 - (eb.raw_embedding <=> query_embedding) > similarity_threshold
  order by eb.raw_embedding <=> query_embedding
  limit match_count;
$$;
