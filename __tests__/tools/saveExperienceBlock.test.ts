import { describe, it, expect, mock, beforeEach } from "bun:test";

// ─── Mutable state shared across all tests ───────────────────────────────────
// Each test resets these before running so mocks never bleed across tests.

type InsertResult = { error: string | null };
type AllBlocksResult = { data: { helper_urls: string[] }[]; error: null };

const state = {
  insertResult: { error: null } as InsertResult,
  allBlocksResult: { data: [], error: null } as AllBlocksResult,
  upsertResult: { error: null } as InsertResult,

  // Captured call arguments for assertions
  lastInsertedBlock: null as Record<string, unknown> | null,
  lastUpsertedProfile: null as Record<string, unknown> | null,
  embedTextCalledWith: null as string | null,
};

const FAKE_EMBEDDING = Array(1536).fill(0.1);

// ─── Module mocks (registered before any import of the modules under test) ───

mock.module("@/lib/supabase", () => ({
  getServerClient: () => ({
    from: (table: string) => ({
      insert: (block: Record<string, unknown>) => {
        state.lastInsertedBlock = block;
        return Promise.resolve(state.insertResult);
      },
      select: () => ({
        eq: () => Promise.resolve(state.allBlocksResult),
      }),
      upsert: (data: Record<string, unknown>) => {
        state.lastUpsertedProfile = data;
        return Promise.resolve(state.upsertResult);
      },
    }),
  }),
}));

mock.module("@/lib/embeddings", () => ({
  embedText: (text: string) => {
    state.embedTextCalledWith = text;
    return Promise.resolve(FAKE_EMBEDDING);
  },
}));

// Dynamic import AFTER mocks are registered
const { handleSaveExperienceBlock } = await import(
  "@/lib/tools/saveExperienceBlock"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  user_id: "user-abc-123",
  title: "Software Engineer at Stripe",
  overview: "Built payment infrastructure used by millions.",
  source_type: "resume" as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleSaveExperienceBlock", () => {
  beforeEach(() => {
    state.insertResult = { error: null };
    state.allBlocksResult = { data: [], error: null };
    state.upsertResult = { error: null };
    state.lastInsertedBlock = null;
    state.lastUpsertedProfile = null;
    state.embedTextCalledWith = null;
  });

  // ── Return value ────────────────────────────────────────────────────────────

  it("returns success: true on a clean insert", async () => {
    const result = await handleSaveExperienceBlock(BASE_INPUT);
    expect(result.success).toBe(true);
  });

  it("returns a UUID block_id on success", async () => {
    const result = await handleSaveExperienceBlock(BASE_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(typeof result.block_id).toBe("string");
    // UUID v4 pattern
    expect(result.block_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns success: false with the DB error message when insert fails", async () => {
    state.insertResult = { error: "duplicate key value violates unique constraint" };
    const result = await handleSaveExperienceBlock(BASE_INPUT);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain("duplicate key");
  });

  // ── Block field population ───────────────────────────────────────────────────

  it("inserts a block with the correct user_id, title, and overview", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastInsertedBlock?.user_id).toBe(BASE_INPUT.user_id);
    expect(state.lastInsertedBlock?.title).toBe(BASE_INPUT.title);
    expect(state.lastInsertedBlock?.overview).toBe(BASE_INPUT.overview);
  });

  it("constructs embedded_text as 'title + space + overview'", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    const expected = `${BASE_INPUT.title} ${BASE_INPUT.overview}`;
    expect(state.lastInsertedBlock?.embedded_text).toBe(expected);
  });

  it("calls embedText with the constructed embedded_text", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    const expected = `${BASE_INPUT.title} ${BASE_INPUT.overview}`;
    expect(state.embedTextCalledWith).toBe(expected);
  });

  it("stores the embedding returned by embedText", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastInsertedBlock?.raw_embedding).toEqual(FAKE_EMBEDDING);
  });

  it("defaults source_url to empty string when not provided", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastInsertedBlock?.source_url).toBe("");
  });

  it("defaults helper_urls to empty array when not provided", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastInsertedBlock?.helper_urls).toEqual([]);
  });

  it("passes through source_url when provided", async () => {
    await handleSaveExperienceBlock({ ...BASE_INPUT, source_url: "resume.pdf" });
    expect(state.lastInsertedBlock?.source_url).toBe("resume.pdf");
  });

  it("passes through helper_urls when provided", async () => {
    const urls = ["https://github.com/me/repo", "https://demo.com"];
    await handleSaveExperienceBlock({ ...BASE_INPUT, helper_urls: urls });
    expect(state.lastInsertedBlock?.helper_urls).toEqual(urls);
  });

  it("passes through date_range when provided", async () => {
    await handleSaveExperienceBlock({ ...BASE_INPUT, date_range: "Jun 2022 – Aug 2022" });
    expect(state.lastInsertedBlock?.date_range).toBe("Jun 2022 – Aug 2022");
  });

  // ── Ranking score update ─────────────────────────────────────────────────────

  it("upserts user_profiles after a successful insert", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastUpsertedProfile).not.toBeNull();
  });

  it("upserts the correct user_id into user_profiles", async () => {
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastUpsertedProfile?.user_id).toBe(BASE_INPUT.user_id);
  });

  it("sets ranking_score to 0 when user has no existing blocks with helper URLs", async () => {
    // allBlocksResult returns [] — no existing blocks
    state.allBlocksResult = { data: [], error: null };
    await handleSaveExperienceBlock(BASE_INPUT);
    // computeRankingScore([]) = 0
    expect(state.lastUpsertedProfile?.ranking_score).toBe(0);
  });

  it("includes existing blocks' helper URLs when computing ranking score", async () => {
    // Simulate 2 already-saved blocks: one with 2 helper URLs, one with 0
    state.allBlocksResult = {
      data: [
        { helper_urls: ["https://github.com/a", "https://demo.com"] },
        { helper_urls: [] },
      ],
      error: null,
    };
    await handleSaveExperienceBlock(BASE_INPUT);
    // 2 blocks × 1pt + 2 helpers × 3pt = 8
    expect(state.lastUpsertedProfile?.ranking_score).toBe(8);
  });

  it("does NOT upsert user_profiles when insert fails", async () => {
    state.insertResult = { error: "insert failed" };
    await handleSaveExperienceBlock(BASE_INPUT);
    expect(state.lastUpsertedProfile).toBeNull();
  });
});
