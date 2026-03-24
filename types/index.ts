export type SourceType = "resume" | "linkedin" | "github" | "other" | "manual";

export type ExperienceBlock = {
  user_id: string;
  block_id: string;
  title: string;
  embedded_text: string;   // descriptive summary; also the text passed to the embedding model
  raw_embedding?: number[];
  source_url: string;
  source_type: SourceType;
  helper_urls: string[];
  date_range?: string;
  chunk_tree?: object;
};

// Serializable content block stored in Redis.
// Structurally compatible with Anthropic.ContentBlockParam so it can be
// passed back to the API without transformation.
export type MessageContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type ChatMessage = {
  role: "user" | "assistant";
  // Plain string for text-only messages; block array when the message
  // contains tool_use or tool_result blocks that must be replayed to Claude.
  content: string | MessageContentBlock[];
};

export type OnboardingStep =
  | "welcome"
  | "sources"
  | "enrichment"
  | "review"
  | "complete";

export type OnboardingSession = {
  user_id: string;
  step: OnboardingStep;
  messages: ChatMessage[];
  draft_blocks: Omit<ExperienceBlock, "raw_embedding">[];
  processed_sources: SourceType[];
  created_at: string;
  updated_at: string;
};

// Skills map stored in user_profiles.skills JSONB column.
// Keys are skill names (e.g. "React", "Leadership"); values are scores 1–5.
export type SkillsMap = Record<string, number>;

export type RankedCandidate = {
  user_id: string;
  display_name?: string;
  ranking_score: number;
  matching_blocks: ExperienceBlock[];
  similarity: number;
};
