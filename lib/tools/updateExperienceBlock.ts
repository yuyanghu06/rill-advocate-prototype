import type Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";
import { computeRankingScore } from "@/lib/ranking";
import { refreshUserHeadline } from "@/lib/tools/refreshUserHeadline";
import { refreshCapabilityBullets } from "@/lib/tools/refreshCapabilityBullets";
import type { ExperienceBlock } from "@/types";

export const updateExperienceBlockTool: Anthropic.Tool = {
  name: "update_experience_block",
  description:
    "Update an existing experience block with enriched details gathered during conversation — helper URLs, an improved description, source URL, or corrected date range. Call this after save_experience_block once the user provides more information. Only pass the fields that have changed.",
  input_schema: {
    type: "object",
    properties: {
      block_id: {
        type: "string",
        description: "The block_id returned by save_experience_block",
      },
      user_id: {
        type: "string",
        description: "The authenticated user's ID from Supabase Auth",
      },
      embedded_text: {
        type: "string",
        description:
          "Updated 2-3 sentence summary if the description has been enriched from conversation. Triggers re-embedding.",
      },
      helper_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "Full updated list of supporting URLs for this block — repos, demos, write-ups, etc. Replaces the existing list.",
      },
      source_url: {
        type: "string",
        description: "URL or filename of the original source, if not set during initial save.",
      },
      date_range: {
        type: "string",
        description: "Corrected or newly provided date range, e.g. 'Jun 2022 – Aug 2022'",
      },
    },
    required: ["block_id", "user_id"],
  },
};

type UpdateInput = {
  block_id: string;
  user_id: string;
  embedded_text?: string;
  helper_urls?: string[];
  source_url?: string;
  date_range?: string;
};

export async function handleUpdateExperienceBlock(input: UpdateInput) {
  const db = getServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (input.embedded_text !== undefined) {
    updates.embedded_text = input.embedded_text;
    updates.raw_embedding = await embedText(input.embedded_text);
  }
  if (input.helper_urls !== undefined) updates.helper_urls = input.helper_urls;
  if (input.source_url !== undefined) updates.source_url = input.source_url;
  if (input.date_range !== undefined) updates.date_range = input.date_range;

  console.log(`[db:update] experience_blocks`, JSON.stringify({
    block_id: input.block_id,
    user_id: input.user_id,
    fields: Object.keys(updates).filter((k) => k !== "updated_at" && k !== "raw_embedding"),
    helper_urls: input.helper_urls,
    source_url: input.source_url,
    date_range: input.date_range,
  }, null, 2));

  const { error } = await db
    .from("experience_blocks")
    .update(updates)
    .eq("block_id", input.block_id);

  if (error) {
    return { success: false, message: error.message };
  }

  // Recompute ranking score since helper_urls may have changed
  const { data: allBlocks } = await db
    .from("experience_blocks")
    .select("helper_urls")
    .eq("user_id", input.user_id);

  const score = computeRankingScore((allBlocks ?? []) as ExperienceBlock[]);
  console.log(`[db:upsert] user_profiles`, JSON.stringify({
    user_id: input.user_id,
    ranking_score: score,
  }, null, 2));
  await db
    .from("user_profiles")
    .upsert(
      { user_id: input.user_id, ranking_score: score, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  // Regenerate headline from all block titles (fire-and-forget — don't block the response)
  refreshUserHeadline(input.user_id).catch((err) =>
    console.error("[refreshUserHeadline] update error", err)
  );

  // Regenerate capability bullets (fire-and-forget)
  refreshCapabilityBullets(input.user_id).catch((err) =>
    console.error("[refreshCapabilityBullets] update error", err)
  );

  return { success: true, message: "Experience block updated." };
}
