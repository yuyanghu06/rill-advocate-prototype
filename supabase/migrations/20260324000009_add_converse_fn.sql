-- Fix match_experience_blocks: remove stale `overview` column reference (dropped in migration 000007).
-- Also add match_user_experience_blocks — a user-scoped variant for the Converse feature.
-- Unlike match_experience_blocks (recruiter, SECURITY DEFINER, cross-user), this function
-- is called server-side with the authenticated user's id injected from the session cookie,
-- so it does NOT need SECURITY DEFINER — RLS handles the rest.

drop function if exists match_experience_blocks(vector, int, float);

create or replace function match_experience_blocks(
  query_embedding      vector(1536),
  match_count          int     default 20,
  similarity_threshold float   default 0.35
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
    and 1 - (eb.raw_embedding <=> query_embedding) > similarity_threshold
  order by eb.raw_embedding <=> query_embedding
  limit match_count;
$$;

-- User-scoped similarity search for the Converse page.
-- Returns the top-k experience blocks for a specific user ordered by cosine similarity.
-- Called by /api/converse with the authenticated user's id.
create or replace function match_user_experience_blocks(
  p_user_id            uuid,
  query_embedding      vector(1536),
  match_count          int   default 5
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
  order by eb.raw_embedding <=> query_embedding
  limit match_count;
$$;
