import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * GET /api/profile/[userId]
 *
 * Returns all finalized experience blocks and the ranking score for a user.
 * The raw_embedding vector column is excluded from the response.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const db = getServerClient();
  const [blocksResult, profileResult] = await Promise.all([
    db
      .from("experience_blocks")
      .select(
        "block_id, title, overview, source_type, source_url, helper_urls, date_range, embedded_text, chunk_tree"
      )
      .eq("user_id", userId)
      .order("date_range", { ascending: false }),

    db
      .from("user_profiles")
      .select("ranking_score, display_name")
      .eq("user_id", userId)
      .single(),
  ]);

  if (blocksResult.error) {
    return NextResponse.json(
      { error: blocksResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    user_id: userId,
    display_name: profileResult.data?.display_name ?? null,
    ranking_score: profileResult.data?.ranking_score ?? 0,
    blocks: blocksResult.data,
  });
}
