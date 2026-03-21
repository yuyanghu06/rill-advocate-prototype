import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/redis";
import { getServerClient } from "@/lib/supabase";
import { embedBatch } from "@/lib/embeddings";
import { computeRankingScore } from "@/lib/ranking";
import type { ExperienceBlock } from "@/types";

/**
 * POST /api/onboarding/finalize
 *
 * Flushes the completed onboarding session from Redis to Supabase:
 *   1. Loads draft blocks from Redis
 *   2. Generates embeddings for all blocks in one batch
 *   3. Upserts blocks into Supabase (experience_blocks table)
 *   4. Writes/updates the user's ranking score (user_profiles table)
 *   5. Deletes the session from Redis
 *
 * Body: { userId: string }
 */
export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const session = await getSession(userId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.step !== "complete") {
    return NextResponse.json(
      { error: "Onboarding is not complete" },
      { status: 422 }
    );
  }

  const draftBlocks = session.draft_blocks;
  if (draftBlocks.length === 0) {
    return NextResponse.json({ error: "No blocks to finalize" }, { status: 422 });
  }

  // Generate embeddings for all blocks in a single API call
  const embeddedTexts = draftBlocks.map(
    (b) => b.embedded_text || `${b.title} ${b.overview}`
  );
  const embeddings = await embedBatch(embeddedTexts);

  const blocks: ExperienceBlock[] = draftBlocks.map((b, i) => ({
    ...b,
    user_id: userId,
    raw_embedding: embeddings[i],
  }));

  // Upsert blocks into Supabase
  const { error: blocksError } = await getServerClient()
    .from("experience_blocks")
    .upsert(blocks, { onConflict: "block_id" });

  if (blocksError) {
    return NextResponse.json(
      { error: blocksError.message },
      { status: 500 }
    );
  }

  // Update ranking score
  const rankingScore = computeRankingScore(blocks);
  const { error: profileError } = await getServerClient()
    .from("user_profiles")
    .upsert({ user_id: userId, ranking_score: rankingScore, updated_at: new Date().toISOString() }, {
      onConflict: "user_id",
    });

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  // Clean up Redis session
  await deleteSession(userId);

  return NextResponse.json({
    success: true,
    blocks_saved: blocks.length,
    ranking_score: rankingScore,
  });
}
