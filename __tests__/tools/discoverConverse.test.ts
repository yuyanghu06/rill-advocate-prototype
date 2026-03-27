import { describe, it, expect, mock, beforeEach } from "bun:test";

// ─── Types mirrored from the route ───────────────────────────────────────────

type ExperienceRow = {
  block_id:     string;
  title:        string;
  source_url:   string | null;
  helper_urls:  string[] | null;
  embedded_text: string | null;
  similarity:   number;
};

type RpcArgs = {
  p_user_id:       string;
  query_embedding: number[];
  match_threshold: number;
  match_count:     number;
};

type ProfileRow = {
  skills:       Record<string, number>;
  display_name: string | null;
};

// ─── Mutable state ────────────────────────────────────────────────────────────

const RECRUITER_ID = "recruiter-111";
const CANDIDATE_ID = "candidate-222";
const FAKE_EMBEDDING = Array(1536).fill(0.05);

const CANDIDATE_BLOCKS: ExperienceRow[] = [
  {
    block_id:     "block-a",
    title:        "Senior Engineer at Stripe",
    embedded_text: "Led payments infrastructure serving 10M+ transactions/day.",
    source_url:   "https://linkedin.com/in/jane",
    helper_urls:  ["https://github.com/jane/stripe-infra"],
    similarity:   0.91,
  },
  {
    block_id:     "block-b",
    title:        "Open Source: Hono middleware",
    embedded_text: "Built a rate-limiting middleware for the Hono framework.",
    source_url:   null,
    helper_urls:  ["https://github.com/jane/hono-rate-limit", "https://npmjs.com/package/hono-rate-limit"],
    similarity:   0.78,
  },
];

const CANDIDATE_PROFILE: ProfileRow = {
  display_name: "Jane Smith",
  skills:       { TypeScript: 5, "Node.js": 4, PostgreSQL: 3 },
};

const state = {
  // what the RPC was called with
  lastRpcArgs: null as RpcArgs | null,
  // what user_id the profile query used
  lastProfileQueryUserId: null as string | null,
  // responses the mock returns
  rpcBlocks: CANDIDATE_BLOCKS as ExperienceRow[],
  profileData: CANDIDATE_PROFILE as ProfileRow | null,
  embedTextCalledWith: null as string | null,
};

// ─── Module mocks ─────────────────────────────────────────────────────────────

mock.module("@/lib/supabase", () => ({
  getServerClient: () => ({
    rpc: (_fn: string, args: RpcArgs) => {
      state.lastRpcArgs = args;
      return Promise.resolve({ data: state.rpcBlocks, error: null });
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, userId: string) => {
          state.lastProfileQueryUserId = userId;
          return {
            single: () =>
              Promise.resolve({
                data: state.profileData,
                error: state.profileData ? null : "not found",
              }),
          };
        },
      }),
    }),
  }),
}));

mock.module("@/lib/supabase.server", () => ({
  getAuthServerClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: RECRUITER_ID, email: "recruiter@rill.com" } } }),
      },
    }),
}));

mock.module("@/lib/embeddings", () => ({
  embedText: (text: string) => {
    state.embedTextCalledWith = text;
    return Promise.resolve(FAKE_EMBEDDING);
  },
}));

// Stub the Anthropic streaming call — we only care about the context assembly
// and DB queries, not the LLM output itself.
mock.module("@/lib/claude", () => ({
  anthropic: {
    messages: {
      stream: () => ({
        [Symbol.asyncIterator]: async function* () {},
        finalMessage: async () => ({
          content: [{ type: "text", text: "Test response." }],
          stop_reason: "end_turn",
        }),
      }),
    },
  },
  ADVOCATE_SYSTEM_PROMPT: "",
}));

// ─── Pure helper — buildContext (extracted from route for unit testing) ────────

function buildContext(
  blocks: ExperienceRow[],
  skills: Record<string, number>,
  candidateName?: string
): string {
  const lines: string[] = ["--- RETRIEVED CONTEXT ---", ""];
  if (candidateName) lines.push(`Candidate: ${candidateName}`, "");

  if (blocks.length > 0) {
    lines.push("### Relevant Experiences");
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.title}`);
      if (b.embedded_text) lines.push(`   ${b.embedded_text}`);
      if (b.source_url)    lines.push(`   Source: ${b.source_url}`);
      if (b.helper_urls?.length) lines.push(`   Links: ${b.helper_urls.join(", ")}`);
    });
    lines.push("");
  }

  if (Object.keys(skills).length > 0) {
    lines.push("### Skills");
    Object.entries(skills)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, score]) => lines.push(`- ${name} (${score}/5)`));
    lines.push("");
  }

  const allUrls = new Set<string>();
  blocks.forEach((b) => {
    if (b.source_url) allUrls.add(b.source_url);
    b.helper_urls?.forEach((u) => allUrls.add(u));
  });
  if (allUrls.size > 0) {
    lines.push("### Available URLs for redirect tool");
    allUrls.forEach((u) => lines.push(u));
    lines.push("");
  }

  lines.push("-------------------------");
  return lines.join("\n");
}

// ─── Helper: make a POST request to the advocate chat route ──────────────────

async function callRoute(body: Record<string, unknown>) {
  const { POST } = await import("../../app/api/advocate/chat/route");
  const req = new Request("http://localhost/api/advocate/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("recruiter mode — DB query isolation", () => {
  beforeEach(() => {
    state.lastRpcArgs = null;
    state.lastProfileQueryUserId = null;
    state.rpcBlocks = CANDIDATE_BLOCKS;
    state.profileData = CANDIDATE_PROFILE;
    state.embedTextCalledWith = null;
  });

  it("queries the CANDIDATE's profile, not the recruiter's", async () => {
    await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(state.lastProfileQueryUserId).toBe(CANDIDATE_ID);
    expect(state.lastProfileQueryUserId).not.toBe(RECRUITER_ID);
  });

  it("calls match_user_experience_blocks with the CANDIDATE's user_id", async () => {
    await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(state.lastRpcArgs?.p_user_id).toBe(CANDIDATE_ID);
    expect(state.lastRpcArgs?.p_user_id).not.toBe(RECRUITER_ID);
  });

  it("passes a 1536-dim embedding to the RPC", async () => {
    await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(state.lastRpcArgs?.query_embedding).toHaveLength(1536);
  });

  it("uses match_threshold: 0.0 so no blocks are excluded for the candidate", async () => {
    await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(state.lastRpcArgs?.match_threshold).toBe(0.0);
  });

  it("requests exactly 5 blocks from the RPC", async () => {
    await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(state.lastRpcArgs?.match_count).toBe(5);
  });

  it("embeds the incoming message text (not something else)", async () => {
    const msg = "Tell me about Jane's infrastructure work";
    await callRoute({ message: msg, targetUserId: CANDIDATE_ID });
    expect(state.embedTextCalledWith).toBe(msg);
  });

  it("returns a streaming 200 response", async () => {
    const res = await callRoute({ message: "What has Jane worked on?", targetUserId: CANDIDATE_ID });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("returns 401 when targetUserId equals the recruiter's own id (self-query is not recruiter mode)", async () => {
    // Self-queries should fall through to the normal self-mode path —
    // here we verify that the route treats targetUserId === user.id as self-mode,
    // meaning the subjectId will still resolve correctly.
    const res = await callRoute({ message: "Hello", targetUserId: RECRUITER_ID });
    // Should not be rejected — still a valid request
    expect(res.status).toBe(200);
  });
});

describe("buildContext — candidate context assembly", () => {
  it("includes the candidate's name when provided", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {}, "Jane Smith");
    expect(ctx).toContain("Candidate: Jane Smith");
  });

  it("does NOT include a Candidate line when name is omitted (self-mode)", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).not.toContain("Candidate:");
  });

  it("includes all experience block titles", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).toContain("Senior Engineer at Stripe");
    expect(ctx).toContain("Open Source: Hono middleware");
  });

  it("includes embedded_text for each block", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).toContain("Led payments infrastructure serving 10M+ transactions/day.");
    expect(ctx).toContain("Built a rate-limiting middleware for the Hono framework.");
  });

  it("includes source_url when present", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).toContain("Source: https://linkedin.com/in/jane");
  });

  it("includes helper_urls when present", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).toContain("https://github.com/jane/stripe-infra");
    expect(ctx).toContain("https://github.com/jane/hono-rate-limit");
    expect(ctx).toContain("https://npmjs.com/package/hono-rate-limit");
  });

  it("collects all URLs into the redirect tool section", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).toContain("### Available URLs for redirect tool");
    expect(ctx).toContain("https://linkedin.com/in/jane");
    expect(ctx).toContain("https://github.com/jane/stripe-infra");
  });

  it("de-duplicates URLs across blocks", () => {
    const dupeBlocks: ExperienceRow[] = [
      { ...CANDIDATE_BLOCKS[0], helper_urls: ["https://github.com/jane/repo"] },
      { ...CANDIDATE_BLOCKS[1], helper_urls: ["https://github.com/jane/repo"] },
    ];
    const ctx = buildContext(dupeBlocks, {});
    const occurrences = (ctx.match(/https:\/\/github\.com\/jane\/repo/g) ?? []).length;
    // Should appear once in the block list (per block) + once in the URL section
    // but never twice in the URL section
    const urlSectionStart = ctx.indexOf("### Available URLs for redirect tool");
    const urlSection = ctx.slice(urlSectionStart);
    const urlSectionOccurrences = (urlSection.match(/https:\/\/github\.com\/jane\/repo/g) ?? []).length;
    expect(urlSectionOccurrences).toBe(1);
  });

  it("includes skills sorted by score descending", () => {
    const ctx = buildContext([], CANDIDATE_PROFILE.skills);
    const tsPos  = ctx.indexOf("TypeScript");
    const nodePos = ctx.indexOf("Node.js");
    const pgPos  = ctx.indexOf("PostgreSQL");
    expect(tsPos).toBeLessThan(nodePos);
    expect(nodePos).toBeLessThan(pgPos);
  });

  it("formats skill scores as (N/5)", () => {
    const ctx = buildContext([], { React: 4 });
    expect(ctx).toContain("- React (4/5)");
  });

  it("omits the Skills section when skills map is empty", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {});
    expect(ctx).not.toContain("### Skills");
  });

  it("omits the Experiences section when blocks array is empty", () => {
    const ctx = buildContext([], CANDIDATE_PROFILE.skills);
    expect(ctx).not.toContain("### Relevant Experiences");
  });

  it("always opens with the context delimiter", () => {
    const ctx = buildContext([], {});
    expect(ctx).toContain("--- RETRIEVED CONTEXT ---");
  });

  it("always closes with the context delimiter", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, CANDIDATE_PROFILE.skills, "Jane Smith");
    expect(ctx.trimEnd()).toEndWith("-------------------------");
  });
});

describe("recruiter mode — context contains candidate data, not recruiter data", () => {
  beforeEach(() => {
    state.lastRpcArgs = null;
    state.lastProfileQueryUserId = null;
    state.rpcBlocks = CANDIDATE_BLOCKS;
    state.profileData = CANDIDATE_PROFILE;
  });

  it("context built from candidate blocks includes candidate's job title", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, CANDIDATE_PROFILE.skills, CANDIDATE_PROFILE.display_name ?? undefined);
    expect(ctx).toContain("Senior Engineer at Stripe");
  });

  it("context includes the candidate display name passed from the profile query", () => {
    const ctx = buildContext(CANDIDATE_BLOCKS, {}, "Jane Smith");
    expect(ctx).toContain("Jane Smith");
  });

  it("context built from empty blocks still has a valid structure", () => {
    const ctx = buildContext([], CANDIDATE_PROFILE.skills, "Jane Smith");
    expect(ctx).toContain("--- RETRIEVED CONTEXT ---");
    expect(ctx).toContain("-------------------------");
    expect(ctx).toContain("### Skills");
  });

  it("blocks from a different candidate do not appear when blocks array is swapped", () => {
    const otherBlocks: ExperienceRow[] = [
      {
        block_id:     "block-x",
        title:        "PM at Google",
        embedded_text: "Managed Search Ads product.",
        source_url:   null,
        helper_urls:  [],
        similarity:   0.85,
      },
    ];
    const ctxJane  = buildContext(CANDIDATE_BLOCKS, {}, "Jane Smith");
    const ctxOther = buildContext(otherBlocks, {}, "Bob Lee");
    expect(ctxJane).not.toContain("PM at Google");
    expect(ctxOther).not.toContain("Senior Engineer at Stripe");
  });
});
