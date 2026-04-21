import type Anthropic from "@anthropic-ai/sdk";
import { getServerClient } from "@/lib/supabase";
import { refreshCapabilityBullets } from "@/lib/tools/refreshCapabilityBullets";
import type { SkillsMap } from "@/types";

export const upsertSkillsTool: Anthropic.Tool = {
  name: "upsert_skills",
  description: `Infer and persist a user's skills based on their experience blocks and conversation so far.
Call this after processing each source (resume, LinkedIn, GitHub) and after any enrichment conversation that surfaces new or refined skills.
Each call is a partial update — existing skills not included in this call are preserved.
Skill names should be concise and consistent (e.g. "React", "Node.js", "CUDA", "Leadership", "Public Speaking").
Scores are integers 1–5:
  1 = brief exposure / mentioned in passing
  2 = some practical use
  3 = solid working knowledge
  4 = strong proficiency, used regularly
  5 = expert / defining strength`,
  input_schema: {
    type: "object",
    properties: {
      user_id: {
        type: "string",
        description: "The authenticated user's ID from Supabase Auth",
      },
      skills: {
        type: "object",
        description:
          "Map of skill name to score (1–5). Merged into the existing skills map — keys present here overwrite existing values, all other keys are untouched.",
        additionalProperties: { type: "number" },
      },
    },
    required: ["user_id", "skills"],
  },
};

type UpsertSkillsInput = {
  user_id: string;
  skills: SkillsMap;
};

export async function handleUpsertSkills(input: UpsertSkillsInput) {
  const db = getServerClient();

  // Clamp all scores to [1, 5] and round to nearest integer
  const sanitized: SkillsMap = {};
  for (const [name, raw] of Object.entries(input.skills)) {
    const score = Math.round(Math.min(5, Math.max(1, raw)));
    sanitized[name] = score;
  }

  // Fetch existing skills and merge — new values override, old keys survive
  const { data: profile } = await db
    .from("user_profiles")
    .select("skills")
    .eq("user_id", input.user_id)
    .single();

  const existing: SkillsMap = (profile?.skills as SkillsMap) ?? {};
  const merged: SkillsMap = { ...existing, ...sanitized };

  console.log(`[db:upsert] user_profiles.skills`, JSON.stringify({
    user_id: input.user_id,
    updating: sanitized,
    total_skills_after: Object.keys(merged).length,
  }, null, 2));

  const { error } = await db
    .from("user_profiles")
    .upsert(
      { user_id: input.user_id, skills: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) {
    return { success: false, message: error.message };
  }

  // Regenerate capability bullets (fire-and-forget) — skills feed the prompt.
  refreshCapabilityBullets(input.user_id).catch((err) =>
    console.error("[refreshCapabilityBullets] upsertSkills error", err)
  );

  return {
    success: true,
    message: `${Object.keys(sanitized).length} skill(s) updated. Total skills on profile: ${Object.keys(merged).length}.`,
  };
}
