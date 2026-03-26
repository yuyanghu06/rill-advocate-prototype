import { getServerClient } from "@/lib/supabase";
import { anthropic } from "@/lib/claude";

/**
 * Queries all experience block titles for a user, asks Claude to synthesise
 * a one-line profile headline from them, and writes the result back to
 * user_profiles.headline.
 *
 * Called automatically after every save_experience_block /
 * update_experience_block so the headline always reflects the full picture.
 */
export async function refreshUserHeadline(user_id: string): Promise<void> {
  const db = getServerClient();

  // Fetch every block title for this user (titles only — cheap, no embeddings)
  const { data: blocks, error } = await db
    .from("experience_blocks")
    .select("title")
    .eq("user_id", user_id)
    .order("created_at", { ascending: true });

  if (error || !blocks?.length) return;

  const titles = blocks.map((b: { title: string }) => b.title);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", // fast + cheap for a one-liner
    max_tokens: 64,
    system:
      "You write concise one-line professional headlines for talent profiles. " +
      "Output only the headline — no quotes, no explanation, no punctuation at the end. " +
      'Format: "role · key skills · notable context" (max 12 words).',
    messages: [
      {
        role: "user",
        content:
          `Generate a headline for a candidate whose experience includes:\n` +
          titles.map((t) => `- ${t}`).join("\n"),
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text" || !block.text.trim()) return;

  const headline = block.text.trim();

  console.log(`[db:update] user_profiles headline`, JSON.stringify({ user_id, headline }));

  await db
    .from("user_profiles")
    .update({ headline, updated_at: new Date().toISOString() })
    .eq("user_id", user_id);
}
