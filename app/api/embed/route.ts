import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { embedBatch } from "@/lib/embeddings";

/**
 * POST /api/embed
 *
 * Generates OpenAI embeddings for one or more experience blocks
 * and stores the vectors in Supabase via pgvector.
 *
 * Body: { blockIds: string[] }
 *
 * Fetches blocks from Supabase by ID, embeds their embedded_text,
 * then updates each row with the resulting vector.
 */
export async function POST(req: NextRequest) {
  const { blockIds }: { blockIds: string[] } = await req.json();

  if (!blockIds?.length) {
    return NextResponse.json(
      { error: "blockIds array is required" },
      { status: 400 }
    );
  }

  // Fetch blocks that need embedding
  const { data: blocks, error: fetchError } = await getServerClient()
    .from("experience_blocks")
    .select("block_id, embedded_text, title, overview")
    .in("block_id", blockIds);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!blocks?.length) {
    return NextResponse.json({ error: "No blocks found" }, { status: 404 });
  }

  // Generate embeddings in one batch
  const texts = blocks.map(
    (b) => b.embedded_text || `${b.title} ${b.overview}`
  );
  const embeddings = await embedBatch(texts);

  // Update each block with its embedding
  const updates = await Promise.all(
    blocks.map((block, i) =>
      getServerClient()
        .from("experience_blocks")
        .update({ raw_embedding: embeddings[i] })
        .eq("block_id", block.block_id)
    )
  );

  const errors = updates
    .map((r) => r.error)
    .filter(Boolean)
    .map((e) => e!.message);

  if (errors.length) {
    return NextResponse.json(
      { error: "Some updates failed", details: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    embedded: blocks.length,
  });
}
