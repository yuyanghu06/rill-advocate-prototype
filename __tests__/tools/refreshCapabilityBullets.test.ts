import { describe, it, expect, mock, beforeEach } from "bun:test";

// ─── Mutable shared state ───────────────────────────────────────────────────
// Each test resets these via beforeEach.

type BlockRow = { title: string; embedded_text: string | null };
type ProfileRow = {
  skills: Record<string, number> | null;
  top_skills: string[] | null;
} | null;

const state = {
  blocks: [] as BlockRow[],
  profile: null as ProfileRow,

  // Anthropic response
  anthropicText: "",
  anthropicType: "text" as "text" | "tool_use",

  // Capture
  lastUpdatedProfile: null as Record<string, unknown> | null,
  lastUpdatedUserId: null as string | null,
  anthropicCalls: 0,
  anthropicLastPayload: null as {
    system?: string;
    messages: Array<{ role: string; content: string }>;
  } | null,
};

// ─── Mocks ──────────────────────────────────────────────────────────────────

mock.module("@/lib/supabase", () => ({
  getServerClient: () => ({
    from: (table: string) => {
      if (table === "experience_blocks") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: state.blocks, error: null }),
            }),
          }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: state.profile, error: null }),
            }),
          }),
          update: (data: Record<string, unknown>) => {
            state.lastUpdatedProfile = data;
            return {
              eq: (_col: string, val: string) => {
                state.lastUpdatedUserId = val;
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

mock.module("@/lib/claude", () => ({
  anthropic: {
    messages: {
      create: (payload: {
        system?: string;
        messages: Array<{ role: string; content: string }>;
      }) => {
        state.anthropicCalls++;
        state.anthropicLastPayload = payload;
        return Promise.resolve({
          content: [
            state.anthropicType === "text"
              ? { type: "text", text: state.anthropicText }
              : { type: "tool_use", id: "x", name: "y", input: {} },
          ],
        });
      },
    },
  },
}));

// Dynamic import AFTER mocks. Uses relative path — bun test excludes
// __tests__/ from the main tsconfig so `@/` aliases don't resolve here.
const { refreshCapabilityBullets, parseBullets } = await import(
  "../../lib/tools/refreshCapabilityBullets"
);

// ─── parseBullets (pure function) ───────────────────────────────────────────

describe("parseBullets", () => {
  it("parses dash-prefixed bullets", () => {
    const raw = "- Build X\n- Design Y\n- Optimize Z";
    expect(parseBullets(raw)).toEqual(["Build X", "Design Y", "Optimize Z"]);
  });

  it("parses asterisk-prefixed bullets", () => {
    expect(parseBullets("* Alpha\n* Beta")).toEqual(["Alpha", "Beta"]);
  });

  it("parses unicode bullet character", () => {
    expect(parseBullets("• One\n• Two")).toEqual(["One", "Two"]);
  });

  it("parses numbered bullets with periods", () => {
    expect(parseBullets("1. First\n2. Second\n3. Third")).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("parses numbered bullets with parens", () => {
    expect(parseBullets("1) First\n2) Second")).toEqual(["First", "Second"]);
  });

  it("ignores blank lines", () => {
    const raw = "- One\n\n- Two\n\n\n- Three";
    expect(parseBullets(raw)).toEqual(["One", "Two", "Three"]);
  });

  it("trims surrounding whitespace on lines", () => {
    const raw = "   - Leading spaces\n-   Tab-y bullet\t";
    expect(parseBullets(raw)).toEqual(["Leading spaces", "Tab-y bullet"]);
  });

  it("tolerates lines without any bullet marker", () => {
    // A line with no marker is still kept (model may drop the dash on one line)
    const raw = "- One\nTwo\n- Three";
    expect(parseBullets(raw)).toEqual(["One", "Two", "Three"]);
  });

  it("clamps to at most 5 bullets", () => {
    const raw = Array.from({ length: 10 })
      .map((_, i) => `- Item ${i}`)
      .join("\n");
    expect(parseBullets(raw)).toHaveLength(5);
    expect(parseBullets(raw)[0]).toBe("Item 0");
    expect(parseBullets(raw)[4]).toBe("Item 4");
  });

  it("returns an empty array on empty input", () => {
    expect(parseBullets("")).toEqual([]);
    expect(parseBullets("\n\n\n")).toEqual([]);
  });

  it("drops a marker line that has no text after the marker", () => {
    expect(parseBullets("- \n- Real bullet")).toEqual(["Real bullet"]);
  });

  it("preserves inner punctuation in bullets", () => {
    const raw = "- Build X, Y, and Z (using Python).";
    expect(parseBullets(raw)).toEqual([
      "Build X, Y, and Z (using Python).",
    ]);
  });
});

// ─── refreshCapabilityBullets (integration with mocked IO) ──────────────────

const BASE_BLOCKS: BlockRow[] = [
  {
    title: "Software Engineer Intern at Stripe",
    embedded_text: "Built payment APIs used by millions.",
  },
  {
    title: "Pocket-Money App",
    embedded_text: "Shipped a React Native app with 10k users.",
  },
];

const BASE_PROFILE: ProfileRow = {
  skills: { React: 4, TypeScript: 5, Leadership: 3 },
  top_skills: ["TypeScript", "React", "Leadership"],
};

describe("refreshCapabilityBullets", () => {
  beforeEach(() => {
    state.blocks = [...BASE_BLOCKS];
    state.profile = { ...(BASE_PROFILE as object) } as ProfileRow;
    state.anthropicText = "- Build X\n- Design Y\n- Optimize Z";
    state.anthropicType = "text";
    state.lastUpdatedProfile = null;
    state.lastUpdatedUserId = null;
    state.anthropicCalls = 0;
    state.anthropicLastPayload = null;
  });

  it("writes parsed bullets to user_profiles on a happy path", async () => {
    await refreshCapabilityBullets("user-1");
    expect(state.lastUpdatedUserId).toBe("user-1");
    expect(state.lastUpdatedProfile?.capability_bullets).toEqual([
      "Build X",
      "Design Y",
      "Optimize Z",
    ]);
  });

  it("sets updated_at to an ISO timestamp", async () => {
    await refreshCapabilityBullets("user-1");
    const ts = state.lastUpdatedProfile?.updated_at as string;
    expect(typeof ts).toBe("string");
    expect(() => new Date(ts).toISOString()).not.toThrow();
  });

  it("no-ops (no Anthropic call, no DB write) when user has zero blocks", async () => {
    state.blocks = [];
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(0);
    expect(state.lastUpdatedProfile).toBeNull();
  });

  it("no-ops when combined block content is below the minimum signal threshold", async () => {
    // Tiny single block, well under MIN_CONTENT_CHARS (120)
    state.blocks = [{ title: "Project X", embedded_text: "A tiny thing." }];
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(0);
    expect(state.lastUpdatedProfile).toBeNull();
  });

  it("no-ops when Claude returns an empty text block", async () => {
    state.anthropicText = "";
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(1);
    expect(state.lastUpdatedProfile).toBeNull();
  });

  it("no-ops when Claude returns a non-text content block", async () => {
    state.anthropicType = "tool_use";
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(1);
    expect(state.lastUpdatedProfile).toBeNull();
  });

  it("calls Anthropic exactly once per refresh", async () => {
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(1);
  });

  it("sends the capability-bullet system prompt to Claude", async () => {
    await refreshCapabilityBullets("user-1");
    const sys = state.anthropicLastPayload?.system ?? "";
    expect(sys).toContain("high-signal candidate profile");
    expect(sys).toContain("GENERALIZED ACTIONS");
    expect(sys).toContain("Start each bullet with a verb");
  });

  it("includes every block title and description in the user message", async () => {
    await refreshCapabilityBullets("user-1");
    const msg = state.anthropicLastPayload?.messages[0].content ?? "";
    expect(msg).toContain("Software Engineer Intern at Stripe");
    expect(msg).toContain("Built payment APIs used by millions.");
    expect(msg).toContain("Pocket-Money App");
    expect(msg).toContain("Shipped a React Native app with 10k users.");
  });

  it("includes skills (ranked by score desc) in the user message", async () => {
    await refreshCapabilityBullets("user-1");
    const msg = state.anthropicLastPayload?.messages[0].content ?? "";
    // TypeScript (5) must appear before React (4), which must appear before Leadership (3)
    const tsIdx = msg.indexOf("TypeScript (5/5)");
    const reactIdx = msg.indexOf("React (4/5)");
    const leadIdx = msg.indexOf("Leadership (3/5)");
    expect(tsIdx).toBeGreaterThan(-1);
    expect(reactIdx).toBeGreaterThan(tsIdx);
    expect(leadIdx).toBeGreaterThan(reactIdx);
  });

  it("falls back to top_skills when the skills map is empty", async () => {
    state.profile = { skills: {}, top_skills: ["Go", "Kubernetes"] };
    await refreshCapabilityBullets("user-1");
    const msg = state.anthropicLastPayload?.messages[0].content ?? "";
    expect(msg).toContain("Go, Kubernetes");
  });

  it("still proceeds when there is no profile row at all", async () => {
    state.profile = null;
    await refreshCapabilityBullets("user-1");
    expect(state.anthropicCalls).toBe(1);
    expect(state.lastUpdatedProfile?.capability_bullets).toHaveLength(3);
  });

  it("clamps the stored bullets to at most 5 even if Claude returns more", async () => {
    state.anthropicText = [
      "- One",
      "- Two",
      "- Three",
      "- Four",
      "- Five",
      "- Six",
      "- Seven",
    ].join("\n");
    await refreshCapabilityBullets("user-1");
    const bullets = state.lastUpdatedProfile
      ?.capability_bullets as string[];
    expect(bullets).toHaveLength(5);
    expect(bullets[0]).toBe("One");
    expect(bullets[4]).toBe("Five");
  });

  it("renders block titles without a description when embedded_text is null", async () => {
    // Content must exceed the minimum-signal threshold, otherwise the guard
    // no-ops before we get to assemble the user message.
    state.blocks = [
      { title: "Only-title block at a well-known company", embedded_text: null },
      {
        title: "Normal block",
        embedded_text:
          "Shipped a production service handling millions of requests per day with sub-100ms p99.",
      },
    ];
    await refreshCapabilityBullets("user-1");
    const msg = state.anthropicLastPayload?.messages[0].content ?? "";
    expect(msg).toContain("- Only-title block at a well-known company\n");
    expect(msg).toContain(
      "- Normal block: Shipped a production service handling millions of requests per day with sub-100ms p99."
    );
  });
});
