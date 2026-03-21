import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";
import { computeRankingScore } from "@/lib/ranking";
import type { RankedCandidate, ExperienceBlock } from "@/types";

const DEFAULT_MATCH_COUNT = 20;
const DEFAULT_SIMILARITY_THRESHOLD = 0.35;

/**
 * POST /api/search
 *
 * Recruiter semantic search endpoint.
 * Embeds the natural language query, runs a pgvector similarity search
 * against all experience blocks, groups results by user, and returns
 * ranked candidate summaries.
 *
 * Body: {
 *   query: string;
 *   matchCount?: number;          // max blocks to retrieve (default 20)
 *   similarityThreshold?: number; // cosine similarity floor 0–1 (default 0.35)
 * }
 *
 * Requires a Supabase SQL function `match_experience_blocks` (see below).
 *
 * -- Supabase migration:
 * create or replace function match_experience_blocks(
 *   query_embedding vector(1536),
 *   match_count int,
 *   similarity_threshold float
 * )
 * returns table (
 *   block_id uuid, user_id uuid, title text, overview text,
 *   source_type text, source_url text, helper_urls text[],
 *   date_range text, embedded_text text, chunk_tree jsonb,
 *   similarity float
 * )
 * language sql stable as $$
 *   select
 *     eb.block_id, eb.user_id, eb.title, eb.overview,
 *     eb.source_type, eb.source_url, eb.helper_urls,
 *     eb.date_range, eb.embedded_text, eb.chunk_tree,
 *     1 - (eb.raw_embedding <=> query_embedding) as similarity
 *   from experience_blocks eb
 *   where 1 - (eb.raw_embedding <=> query_embedding) > similarity_threshold
 *   order by similarity desc
 *   limit match_count;
 * $$;
 */
export async function POST(req: NextRequest) {
  const {
    query,
    matchCount = DEFAULT_MATCH_COUNT,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
  }: {
    query: string;
    matchCount?: number;
    similarityThreshold?: number;
  } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  // Embed the recruiter's query
  const queryEmbedding = await embedText(query);

  // Run pgvector similarity search via Supabase RPC
  const { data: matchedBlocks, error } = await getServerClient().rpc(
    "match_experience_blocks",
    {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      similarity_threshold: similarityThreshold,
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!matchedBlocks?.length) {
    return NextResponse.json({ candidates: [] });
  }

  // Group blocks by user_id
  const byUser = new Map<
    string,
    { blocks: (ExperienceBlock & { similarity: number })[]; topSimilarity: number }
  >();

  for (const block of matchedBlocks) {
    const entry = byUser.get(block.user_id);
    if (entry) {
      entry.blocks.push(block);
      entry.topSimilarity = Math.max(entry.topSimilarity, block.similarity);
    } else {
      byUser.set(block.user_id, { blocks: [block], topSimilarity: block.similarity });
    }
  }

  // Fetch ranking scores and display names for matched users
  const userIds = Array.from(byUser.keys());
  const { data: profiles } = await getServerClient()
    .from("user_profiles")
    .select("user_id, ranking_score, display_name")
    .in("user_id", userIds);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

  // Build ranked candidate list
  const candidates: RankedCandidate[] = Array.from(byUser.entries()).map(
    ([userId, { blocks, topSimilarity }]) => {
      const profile = profileMap.get(userId);
      return {
        user_id: userId,
        display_name: profile?.display_name ?? null,
        ranking_score:
          profile?.ranking_score ?? computeRankingScore(blocks),
        matching_blocks: blocks,
        similarity: topSimilarity,
      };
    }
  );

  // Sort by semantic similarity first, ranking score as tiebreaker
  candidates.sort(
    (a, b) =>
      b.similarity - a.similarity ||
      b.ranking_score - a.ranking_score
  );

  return NextResponse.json({ candidates });
}
