import type Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";
import { computeRankingScore } from "@/lib/ranking";
import { refreshUserHeadline } from "@/lib/tools/refreshUserHeadline";
import { refreshCapabilityBullets } from "@/lib/tools/refreshCapabilityBullets";
import type { ExperienceBlock } from "@/types";

export const saveExperienceBlockTool: Anthropic.Tool = {
  name: "save_experience_block",
  description:
    "Insert a new experience block into the database. Call this immediately after extracting each experience from a resume or other source — do not wait for enrichment. One call per block; do not batch. Returns a block_id you must pass to update_experience_block when adding helper URLs or enriched details later.",
  input_schema: {
    type: "object",
    properties: {
      user_id: {
        type: "string",
        description: "The authenticated user's ID from Supabase Auth",
      },
      title: {
        type: "string",
        description:
          "Short title of the experience, e.g. 'Software Engineer Intern at Stripe'",
      },
      embedded_text: {
        type: "string",
        description:
          "2-3 sentence summary of the experience. This is the human-readable description and the text that will be embedded for semantic search.",
      },
      source_type: {
        type: "string",
        enum: ["resume", "linkedin", "github", "manual"],
        description: "The source this block was derived from",
      },
      source_url: {
        type: "string",
        description:
          "URL or filename of the original source (e.g. resume PDF name, LinkedIn export filename)",
      },
      helper_urls: {
        type: "array",
        items: { type: "string" },
        description:
          "Any supporting URLs already present in the source — repos, project links, demos, etc.",
      },
      date_range: {
        type: "string",
        description:
          "Date range of the experience if available, e.g. 'Jun 2022 – Aug 2022'",
      },
    },
    required: ["user_id", "title", "embedded_text", "source_type"],
  },
};

type SaveInput = {
  user_id: string;
  title: string;
  embedded_text: string;
  source_type: "resume" | "linkedin" | "github" | "manual";
  source_url?: string;
  helper_urls?: string[];
  date_range?: string;
};

export async function handleSaveExperienceBlock(input: SaveInput) {
  const db = getServerClient();
  const block_id = crypto.randomUUID();
  const raw_embedding = await embedText(input.embedded_text);

  const block: ExperienceBlock = {
    block_id,
    user_id: input.user_id,
    title: input.title,
    embedded_text: input.embedded_text,
    raw_embedding,
    source_type: input.source_type,
    source_url: input.source_url ?? "",
    helper_urls: input.helper_urls ?? [],
    date_range: input.date_range,
  };

  console.log(`[db:insert] experience_blocks`, JSON.stringify({
    block_id,
    user_id: block.user_id,
    title: block.title,
    source_type: block.source_type,
    source_url: block.source_url,
    helper_urls: block.helper_urls,
    date_range: block.date_range,
  }, null, 2));
  const { error } = await db.from("experience_blocks").insert(block);

  if (error) {
    return { success: false, message: error.message };
  }

  // Recompute ranking score from all user blocks
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
    console.error("[refreshUserHeadline] save error", err)
  );

  // Regenerate capability bullets (fire-and-forget)
  refreshCapabilityBullets(input.user_id).catch((err) =>
    console.error("[refreshCapabilityBullets] save error", err)
  );

  return {
    success: true,
    block_id,
    message: "Experience block saved. Use block_id in update_experience_block to enrich this block later.",
  };
}
