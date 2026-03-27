import { NextRequest, NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";

type Params = { params: Promise<{ blockId: string }> };

/**
 * PATCH /api/settings/blocks/[blockId]
 * Body: { title?, embedded_text?, date_range?, helper_urls? }
 *
 * If embedded_text is updated, a new embedding is generated and stored.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  const body = await req.json() as {
    title?: string;
    embedded_text?: string;
    date_range?: string;
    helper_urls?: string[];
  };

  const db = getServerClient();

  // Verify the block belongs to this user
  const { data: existing, error: fetchError } = await db
    .from("experience_blocks")
    .select("block_id, user_id, embedded_text")
    .eq("block_id", blockId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.date_range !== undefined) updates.date_range = body.date_range.trim();
  if (body.helper_urls !== undefined) updates.helper_urls = body.helper_urls.map((u) => u.trim()).filter(Boolean);

  if (body.embedded_text !== undefined) {
    const newText = body.embedded_text.trim();
    updates.embedded_text = newText;
    // Re-embed whenever the descriptive text changes
    const embedding = await embedText(newText);
    updates.raw_embedding = `[${embedding.join(",")}]`;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await db
    .from("experience_blocks")
    .update(updates)
    .eq("block_id", blockId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/settings/blocks/[blockId]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  const db = getServerClient();

  const { data: existing } = await db
    .from("experience_blocks")
    .select("user_id")
    .eq("block_id", blockId)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await db.from("experience_blocks").delete().eq("block_id", blockId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
