import { getServerClient } from "@/lib/supabase";
import { anthropic } from "@/lib/claude";
import type { SkillsMap } from "@/types";

const SYSTEM_PROMPT = `You are generating a section for a high-signal candidate profile for a startup hiring marketplace.

Goal: Convert raw candidate data (resume, GitHub, experience) into a concise 3-5 short bullet points that describe what this person can do, based on their experience, resume, and projects. This goes into a structured profile that helps founders quickly decide whether to interview.

IMPORTANT PRINCIPLES:
- Do NOT repeat resume bullets verbatim
- Do NOT use vague traits (e.g., "hardworking", "team player", "passionate")
- Capabilities should be expressed as GENERALIZED ACTIONS (what they can do across contexts)
- Optimize for clarity, concreteness, and scanability

OUTPUT FORMAT:
Write 3–5 short bullet points describing what this person can do. Output ONLY the bullets — no preamble, no trailing commentary, no headings.

Format:
- Build X...
- Turn Y into Z...
- Design / implement / optimize...

STYLE:
- Start each bullet with a verb (Build, Design, Turn, Automate, Analyze, etc.)
- Generalize beyond a single company or project
- Keep each bullet to one line
- Make them feel like capabilities, not tasks or job descriptions

GOOD EXAMPLES:
- Connect tools (Clay, Apollo, CRM) into a single working GTM system
- Set up and automate CRM workflows to route, enrich, and manage leads end-to-end
- Build and manage databases, including schema design and query optimization`;

/**
 * Parse Claude's raw bullet output into a clean string[].
 *
 * Accepts bullets prefixed with `-`, `*`, `•`, or numbered (`1.`), tolerates
 * leading whitespace and blank lines, trims trailing punctuation whitespace,
 * and clamps the result to at most 5 bullets (the prompt asks for 3-5).
 *
 * Exported so it can be unit-tested without network calls.
 */
export function parseBullets(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const bullets: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Strip leading bullet markers: "- ", "* ", "• ", "1. ", "2) ", etc.
    // `\s*` (not `\s+`) so a marker-only line like "- " strips to "" and is
    // then dropped by the empty-check below.
    const stripped = trimmed.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!stripped) continue;

    bullets.push(stripped);
  }

  return bullets.slice(0, 5);
}

type BlockRow = { title: string; embedded_text: string | null };
type ProfileRow = { skills: SkillsMap | null; top_skills: string[] | null };

// Below this combined text length there isn't enough signal to generate
// capabilities without hallucinating — skip the Claude call.
const MIN_CONTENT_CHARS = 120;

/**
 * Regenerate capability_bullets for a user from all of their experience blocks
 * plus their skills map, and write the result to user_profiles.capability_bullets.
 *
 * Called fire-and-forget from save_experience_block, update_experience_block,
 * and upsert_skills so the bullets always reflect the latest profile state.
 *
 * Silent no-ops:
 *   - User has no experience blocks yet (nothing to summarise).
 *   - Combined block content is below MIN_CONTENT_CHARS (too little signal).
 *   - Claude returns an empty / non-text response.
 */
export async function refreshCapabilityBullets(user_id: string): Promise<void> {
  const db = getServerClient();

  const [blocksResult, profileResult] = await Promise.all([
    db
      .from("experience_blocks")
      .select("title, embedded_text")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true }),
    db
      .from("user_profiles")
      .select("skills, top_skills")
      .eq("user_id", user_id)
      .single(),
  ]);

  const blocks = (blocksResult.data ?? []) as BlockRow[];
  if (!blocks.length) return;

  const totalChars = blocks.reduce(
    (sum, b) => sum + b.title.length + (b.embedded_text?.length ?? 0),
    0
  );
  if (totalChars < MIN_CONTENT_CHARS) return;

  const profile = (profileResult.data ?? null) as ProfileRow | null;
  const skills = profile?.skills ?? {};
  const topSkills = profile?.top_skills ?? [];

  // Rank skills by score so the strongest ones lead the prompt.
  const rankedSkills = Object.entries(skills)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `${name} (${score}/5)`);

  const skillLine = rankedSkills.length
    ? rankedSkills.join(", ")
    : topSkills.join(", ") || "(none provided)";

  const experienceBlock = blocks
    .map((b) => {
      const desc = b.embedded_text?.trim();
      return desc ? `- ${b.title}: ${desc}` : `- ${b.title}`;
    })
    .join("\n");

  const userMessage =
    `Candidate skills: ${skillLine}\n\n` +
    `Candidate experience:\n${experienceBlock}\n\n` +
    `Write 3-5 capability bullets for this candidate.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const contentBlock = response.content[0];
  if (!contentBlock || contentBlock.type !== "text") return;

  const bullets = parseBullets(contentBlock.text);
  if (!bullets.length) return;

  console.log(
    `[db:update] user_profiles capability_bullets`,
    JSON.stringify({ user_id, count: bullets.length })
  );

  await db
    .from("user_profiles")
    .update({ capability_bullets: bullets, updated_at: new Date().toISOString() })
    .eq("user_id", user_id);
}
