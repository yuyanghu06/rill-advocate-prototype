import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Test user IDs ──────────────────────────────────────────────────────────────

const VISIBLE_USER_ID = "vis-user-111";
const HIDDEN_USER_ID  = "hid-user-222";
const FAKE_EMBEDDING  = Array(1536).fill(0.1);

// ── Types ─────────────────────────────────────────────────────────────────────

type RpcBlock = {
  block_id:      string;
  user_id:       string;
  title:         string;
  embedded_text: string;
  source_type:   string;
  source_url:    string;
  helper_urls:   string[];
  date_range:    string | null;
  similarity:    number;
};

type ProfileRow = {
  user_id:          string;
  display_name:     string | null;
  headline:         string | null;
  top_skills:       string[];
  skills:           Record<string, number>;
  helper_url_count: number;
  ranking_score:    number;
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VISIBLE_BLOCK: RpcBlock = {
  block_id:      "block-vis-1",
  user_id:       VISIBLE_USER_ID,
  title:         "Engineer at Acme",
  embedded_text: "Built distributed systems at scale.",
  source_type:   "resume",
  source_url:    "",
  helper_urls:   ["https://github.com/vis/acme"],
  date_range:    "2022–2024",
  similarity:    0.85,
};

const HIDDEN_BLOCK: RpcBlock = {
  block_id:      "block-hid-1",
  user_id:       HIDDEN_USER_ID,
  title:         "Engineer at Hidden Corp",
  embedded_text: "Worked on secret infrastructure.",
  source_type:   "resume",
  source_url:    "",
  helper_urls:   [],
  date_range:    "2021–2023",
  similarity:    0.90, // higher similarity than visible — still must not appear
};

const VISIBLE_PROFILE: ProfileRow = {
  user_id:          VISIBLE_USER_ID,
  display_name:     "Alice Visible",
  headline:         "Software engineer · TypeScript, Go",
  top_skills:       ["TypeScript", "Go"],
  skills:           { TypeScript: 5, Go: 4 },
  helper_url_count: 2,
  ranking_score:    30,
};

// Note: HIDDEN_PROFILE is intentionally never returned by the mock —
// it simulates the DB filtering out is_visible=false rows.

// ── Mutable state ─────────────────────────────────────────────────────────────

const state = {
  rpcBlocks:        [VISIBLE_BLOCK, HIDDEN_BLOCK] as RpcBlock[],
  profiles:         [VISIBLE_PROFILE] as ProfileRow[],
  embedCalledWith:  null as string | null,
};

// ── Module mocks ──────────────────────────────────────────────────────────────

mock.module("@/lib/supabase", () => ({
  getServerClient: () => ({
    rpc: (_fn: string, _args: unknown) =>
      Promise.resolve({ data: state.rpcBlocks, error: null }),
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          limit: (_n: number) =>
            Promise.resolve({ data: state.profiles, error: null }),
        }),
      }),
    }),
  }),
}));

mock.module("@/lib/embeddings", () => ({
  embedText: (text: string) => {
    state.embedCalledWith = text;
    return Promise.resolve(FAKE_EMBEDDING);
  },
}));

// ── Route helper ──────────────────────────────────────────────────────────────

async function callSearch(body: Record<string, unknown>) {
  const { POST } = await import("../../app/api/discover/search/route");
  const req = new Request("http://localhost/api/discover/search", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const res = await POST(req as never);
  return res.json() as Promise<{
    total:   number;
    page:    number;
    results: { user_id: string; display_name?: string }[];
  }>;
}

// ── Pure logic tests — profileMap intersection ────────────────────────────────

describe("visibility gate — profileMap intersection (pure logic)", () => {
  it("visible user in both semanticIds and profileMap is kept", () => {
    const semanticIds = new Set([VISIBLE_USER_ID]);
    const profileMap  = new Map([[VISIBLE_USER_ID, VISIBLE_PROFILE]]);
    const filtered = Array.from(semanticIds).filter((id) => profileMap.has(id));
    expect(filtered).toContain(VISIBLE_USER_ID);
    expect(filtered).toHaveLength(1);
  });

  it("hidden user in semanticIds but absent from profileMap is removed", () => {
    const semanticIds = new Set([HIDDEN_USER_ID]);
    const profileMap  = new Map([[VISIBLE_USER_ID, VISIBLE_PROFILE]]);
    const filtered = Array.from(semanticIds).filter((id) => profileMap.has(id));
    expect(filtered).not.toContain(HIDDEN_USER_ID);
    expect(filtered).toHaveLength(0);
  });

  it("mixed set: only the visible user survives the intersection", () => {
    const semanticIds = new Set([VISIBLE_USER_ID, HIDDEN_USER_ID]);
    const profileMap  = new Map([[VISIBLE_USER_ID, VISIBLE_PROFILE]]);
    const filtered = Array.from(semanticIds).filter((id) => profileMap.has(id));
    expect(filtered).toContain(VISIBLE_USER_ID);
    expect(filtered).not.toContain(HIDDEN_USER_ID);
    expect(filtered).toHaveLength(1);
  });

  it("all hidden: empty semanticIds after intersection", () => {
    const semanticIds = new Set([HIDDEN_USER_ID]);
    const profileMap  = new Map<string, ProfileRow>();
    const filtered = Array.from(semanticIds).filter((id) => profileMap.has(id));
    expect(filtered).toHaveLength(0);
  });

  it("empty semanticIds: result is still empty regardless of profileMap", () => {
    const semanticIds = new Set<string>();
    const profileMap  = new Map([[VISIBLE_USER_ID, VISIBLE_PROFILE]]);
    const filtered = Array.from(semanticIds).filter((id) => profileMap.has(id));
    expect(filtered).toHaveLength(0);
  });
});

// ── Route integration tests — semantic search path ────────────────────────────

describe("discover search — hidden user excluded from semantic results", () => {
  beforeEach(() => {
    state.rpcBlocks       = [VISIBLE_BLOCK, HIDDEN_BLOCK];
    state.profiles        = [VISIBLE_PROFILE]; // DB returns only visible
    state.embedCalledWith = null;
  });

  it("hidden user is not present in results even with higher similarity", async () => {
    // HIDDEN_BLOCK has similarity 0.90 — higher than VISIBLE_BLOCK at 0.85.
    // It must still be excluded because is_visible=false.
    const { results } = await callSearch({ query: "distributed systems" });
    expect(results.some((r) => r.user_id === HIDDEN_USER_ID)).toBe(false);
  });

  it("visible user is returned in semantic search results", async () => {
    const { results } = await callSearch({ query: "distributed systems" });
    expect(results.some((r) => r.user_id === VISIBLE_USER_ID)).toBe(true);
  });

  it("total count does not include hidden user", async () => {
    const { total } = await callSearch({ query: "distributed systems" });
    expect(total).toBe(1);
  });

  it("when ONLY hidden users match semantically, results are empty", async () => {
    state.rpcBlocks = [HIDDEN_BLOCK]; // only hidden user has a semantic match
    state.profiles  = [];             // no visible profiles
    const { total, results } = await callSearch({ query: "secret infrastructure" });
    expect(total).toBe(0);
    expect(results).toHaveLength(0);
  });

  it("hidden user with higher-similarity block does not outrank visible user", async () => {
    const { results } = await callSearch({ query: "engineer" });
    expect(results[0]?.user_id).toBe(VISIBLE_USER_ID);
  });
});

// ── Route integration tests — browse mode (empty query) ───────────────────────

describe("discover search — hidden user excluded from browse mode", () => {
  beforeEach(() => {
    state.rpcBlocks = [VISIBLE_BLOCK, HIDDEN_BLOCK];
    state.profiles  = [VISIBLE_PROFILE]; // DB already excludes hidden profile
  });

  it("browse mode returns only visible users", async () => {
    const { results } = await callSearch({ query: "" });
    expect(results.some((r) => r.user_id === HIDDEN_USER_ID)).toBe(false);
    expect(results.some((r) => r.user_id === VISIBLE_USER_ID)).toBe(true);
  });

  it("browse mode total equals number of visible profiles", async () => {
    const { total } = await callSearch({ query: "" });
    expect(total).toBe(1);
  });

  it("browse mode with no visible profiles returns empty results", async () => {
    state.profiles = [];
    const { total, results } = await callSearch({ query: "" });
    expect(total).toBe(0);
    expect(results).toHaveLength(0);
  });
});

// ── Route integration tests — keyword expansion path ──────────────────────────

describe("discover search — hidden user not surfaced via keyword expansion", () => {
  beforeEach(() => {
    // No semantic blocks returned — keyword expansion is the only path
    state.rpcBlocks = [];
    state.profiles  = [VISIBLE_PROFILE]; // DB already excludes hidden profile
  });

  it("keyword matching a hidden user's skills does not surface them", async () => {
    // Simulate: hidden user has "Python" in skills but their profile is not in
    // the visible profiles list (is_visible=false filtered by DB).
    // The keyword expansion loop only iterates over state.profiles (visible ones),
    // so the hidden user cannot be added via keyword match.
    const { results } = await callSearch({ query: "Python secret" });
    expect(results.some((r) => r.user_id === HIDDEN_USER_ID)).toBe(false);
  });

  it("keyword matching a visible user's skills does surface them", async () => {
    const { results } = await callSearch({ query: "TypeScript" });
    expect(results.some((r) => r.user_id === VISIBLE_USER_ID)).toBe(true);
  });
});
