export type SourceType = "resume" | "linkedin" | "github" | "other";

export type ExperienceBlock = {
  user_id: string;
  block_id: string;
  title: string;
  overview: string;
  embedded_text: string;
  raw_embedding?: number[];
  source_url: string;
  source_type: SourceType;
  helper_urls: string[];
  date_range?: string;
  chunk_tree?: object;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

export type RankedCandidate = {
  user_id: string;
  display_name?: string;
  ranking_score: number;
  matching_blocks: ExperienceBlock[];
  similarity: number;
};
