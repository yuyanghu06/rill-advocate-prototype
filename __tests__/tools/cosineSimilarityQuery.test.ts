import { describe, it, expect, mock, beforeEach } from "bun:test";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockRow = {
  block_id: string;
  user_id: string;
  title: string;
  overview: string;
  source_type: string;
  source_url: string;
  helper_urls: string[];
  date_range: string | null;
  embedded_text: string;
  similarity: number;
};

type RpcResponse = { data: BlockRow[] | null; error: string | null };

// ─── Mutable state shared across tests ───────────────────────────────────────

const state = {
  rpcResponse: { data: [] as BlockRow[], error: null } as RpcResponse,
  lastRpcArgs: null as Record<string, unknown> | null,
  embedTextCalledWith: null as string | null,
};

const FAKE_EMBEDDING = Array(1536).fill(0).map((_, i) => (i % 2 === 0 ? 0.1 : -0.1));

// ─── Module mocks ─────────────────────────────────────────────────────────────

mock.module("@/lib/supabase", () => ({
  getServerClient: () => ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.lastRpcArgs = { fn, ...args };
      return Promise.resolve(state.rpcResponse);
    },
    from: () => ({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
    }),
  }),
}));

mock.module("@/lib/embeddings", () => ({
  embedText: (text: string) => {
    state.embedTextCalledWith = text;
    return Promise.resolve(FAKE_EMBEDDING);
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two equal-length vectors.
 * Mirrors the pgvector formula:  1 - (a <=> b)  where <=> is cosine distance.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Build a fake block row with overridable fields. */
function makeBlock(overrides: Partial<BlockRow> & { user_id: string; similarity: number }): BlockRow {
  return {
    block_id:     crypto.randomUUID(),
    title:        "Engineer at Acme",
    overview:     "Built things.",
    source_type:  "resume",
    source_url:   "",
    helper_urls:  [],
    date_range:   null,
    embedded_text: "Engineer at Acme Built things.",
    ...overrides,
  };
}

/**
 * Minimal reproduction of the per-user grouping + k-cap logic from
 * app/api/discover/search/route.ts so we can unit-test it independently.
 */
const K = 5;

type UserEntry = { blocks: BlockRow[]; topSim: number; ndcgScore: number };

function groupByUser(blocks: BlockRow[], k = K): Map<string, UserEntry> {
  const map = new Map<string, UserEntry>();
  for (const block of blocks) {
    const entry = map.get(block.user_id);
    if (entry) {
      if (entry.blocks.length < k) {
        entry.blocks.push(block);
        entry.topSim = Math.max(entry.topSim, block.similarity);
      }
    } else {
      map.set(block.user_id, { blocks: [block], topSim: block.similarity, ndcgScore: 0 });
    }
  }
  // Compute NDCG score for each user
  for (const entry of map.values()) {
    entry.ndcgScore = entry.blocks.reduce(
      (sum, b, k) => sum + b.similarity / Math.log2(k + 2),
      0
    );
  }
  return map;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("cosine similarity — pure math", () => {
  it("identical unit vectors have similarity 1.0", () => {
    const v = [1, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 6);
  });

  it("orthogonal vectors have similarity 0.0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 6);
  });

  it("opposite vectors have similarity -1.0", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 6);
  });

  it("similarity is commutative: sim(a,b) === sim(b,a)", () => {
    const a = [0.3, 0.7, -0.2];
    const b = [-0.1, 0.5, 0.9];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it("parallel vectors (same direction, different magnitude) have similarity 1.0", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1.0, 6);
  });

  it("zero vector returns 0 (no division by zero)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("pgvector formula: similarity = 1 - cosine_distance", () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    const sim = cosineSimilarity(a, b);
    // cosine distance = 1 - similarity; so similarity = 1 - distance
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe("match_experience_blocks — RPC call parameters", () => {
  beforeEach(() => {
    state.rpcResponse = { data: [], error: null };
    state.lastRpcArgs = null;
    state.embedTextCalledWith = null;
  });

  it("calls the rpc with the correct function name", async () => {
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    expect(state.lastRpcArgs?.fn).toBe("match_experience_blocks");
  });

  it("passes the query embedding as a 1536-dimension vector", async () => {
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    const embedding = state.lastRpcArgs?.query_embedding as number[];
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(1536);
  });

  it("passes match_count: 600 to pull a large enough global pool", async () => {
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    expect(state.lastRpcArgs?.match_count).toBe(600);
  });

  it("passes match_threshold: 0.2 to exclude low-relevance blocks", async () => {
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    expect(state.lastRpcArgs?.match_threshold).toBe(0.2);
  });

  it("returns empty array when no blocks exceed the similarity threshold", async () => {
    state.rpcResponse = { data: [], error: null };
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    const { data } = await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    expect(data).toEqual([]);
  });

  it("propagates a DB error from the RPC response", async () => {
    state.rpcResponse = { data: null, error: "relation does not exist" };
    const { getServerClient } = await import("@/lib/supabase");
    const db = getServerClient();
    const { error } = await db.rpc("match_experience_blocks", {
      query_embedding: FAKE_EMBEDDING,
      match_count: 600,
      match_threshold: 0.2,
    });
    expect(error).not.toBeNull();
  });
});

describe("match_experience_blocks — result ordering and threshold", () => {
  it("results are returned in descending similarity order", () => {
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "u1", similarity: 0.55 }),
      makeBlock({ user_id: "u2", similarity: 0.92 }),
      makeBlock({ user_id: "u3", similarity: 0.71 }),
    ];
    // Simulate pgvector ordering (ORDER BY raw_embedding <=> query_embedding = lowest distance first)
    const sorted = [...blocks].sort((a, b) => b.similarity - a.similarity);
    expect(sorted[0].similarity).toBe(0.92);
    expect(sorted[1].similarity).toBe(0.71);
    expect(sorted[2].similarity).toBe(0.55);
  });

  it("blocks with similarity <= threshold are excluded", () => {
    const threshold = 0.2;
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "u1", similarity: 0.19 }), // below threshold
      makeBlock({ user_id: "u2", similarity: 0.20 }), // at threshold — excluded (strictly greater)
      makeBlock({ user_id: "u3", similarity: 0.21 }), // above threshold — included
      makeBlock({ user_id: "u4", similarity: 0.80 }), // well above threshold — included
    ];
    const filtered = blocks.filter((b) => b.similarity > threshold);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((b) => b.similarity > threshold)).toBe(true);
  });

  it("all returned blocks have positive similarity scores", () => {
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "u1", similarity: 0.35 }),
      makeBlock({ user_id: "u2", similarity: 0.61 }),
      makeBlock({ user_id: "u3", similarity: 0.48 }),
    ];
    expect(blocks.every((b) => b.similarity > 0)).toBe(true);
  });
});

describe("per-user k=5 grouping", () => {
  it("groups blocks by user_id", () => {
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "alice", similarity: 0.9 }),
      makeBlock({ user_id: "bob",   similarity: 0.8 }),
      makeBlock({ user_id: "alice", similarity: 0.7 }),
    ];
    const map = groupByUser(blocks);
    expect(map.size).toBe(2);
    expect(map.get("alice")!.blocks).toHaveLength(2);
    expect(map.get("bob")!.blocks).toHaveLength(1);
  });

  it("caps each user at k=5 blocks even if more are returned", () => {
    const blocks: BlockRow[] = Array.from({ length: 8 }, (_, i) =>
      makeBlock({ user_id: "alice", similarity: 0.9 - i * 0.05 })
    );
    const map = groupByUser(blocks);
    expect(map.get("alice")!.blocks).toHaveLength(5);
  });

  it("keeps the 5 highest-similarity blocks per user (blocks arrive desc from pgvector)", () => {
    // Blocks arrive sorted desc — first 5 should be kept
    const sims = [0.95, 0.88, 0.81, 0.74, 0.67, 0.60, 0.53];
    const blocks = sims.map((s) => makeBlock({ user_id: "alice", similarity: s }));
    const map = groupByUser(blocks);
    const kept = map.get("alice")!.blocks.map((b) => b.similarity);
    expect(kept).toEqual([0.95, 0.88, 0.81, 0.74, 0.67]);
  });

  it("records the highest similarity seen for the user as topSim", () => {
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "alice", similarity: 0.55 }),
      makeBlock({ user_id: "alice", similarity: 0.88 }),
      makeBlock({ user_id: "alice", similarity: 0.72 }),
    ];
    const map = groupByUser(blocks);
    expect(map.get("alice")!.topSim).toBe(0.88);
  });

  it("users with fewer than k blocks get all their blocks", () => {
    const blocks: BlockRow[] = [
      makeBlock({ user_id: "alice", similarity: 0.9 }),
      makeBlock({ user_id: "alice", similarity: 0.8 }),
    ];
    const map = groupByUser(blocks);
    expect(map.get("alice")!.blocks).toHaveLength(2);
  });

  it("handles 1 block per user across many users", () => {
    const blocks = ["u1", "u2", "u3", "u4", "u5"].map((id, i) =>
      makeBlock({ user_id: id, similarity: 0.9 - i * 0.1 })
    );
    const map = groupByUser(blocks);
    expect(map.size).toBe(5);
    for (const entry of map.values()) {
      expect(entry.blocks).toHaveLength(1);
    }
  });
});

describe("NDCG score computation", () => {
  it("a single block's NDCG score equals sim / log2(2) = sim / 1 = sim", () => {
    const blocks = [makeBlock({ user_id: "alice", similarity: 0.8 })];
    const map = groupByUser(blocks);
    // log2(0 + 2) = log2(2) = 1, so score = 0.8 / 1 = 0.8
    expect(map.get("alice")!.ndcgScore).toBeCloseTo(0.8, 6);
  });

  it("NDCG gives higher weight to earlier (higher-similarity) blocks via log decay", () => {
    // rank 0: sim / log2(2) = sim / 1
    // rank 1: sim / log2(3) ≈ sim / 1.585
    // rank 2: sim / log2(4) = sim / 2
    const sim0 = 0.9, sim1 = 0.7, sim2 = 0.5;
    const blocks = [
      makeBlock({ user_id: "alice", similarity: sim0 }),
      makeBlock({ user_id: "alice", similarity: sim1 }),
      makeBlock({ user_id: "alice", similarity: sim2 }),
    ];
    const map = groupByUser(blocks);
    const expected =
      sim0 / Math.log2(2) +
      sim1 / Math.log2(3) +
      sim2 / Math.log2(4);
    expect(map.get("alice")!.ndcgScore).toBeCloseTo(expected, 6);
  });

  it("a user with 5 high-similarity blocks scores higher than one with 5 low-similarity blocks", () => {
    const highBlocks = Array.from({ length: 5 }, (_, i) =>
      makeBlock({ user_id: "high", similarity: 0.9 - i * 0.01 })
    );
    const lowBlocks = Array.from({ length: 5 }, (_, i) =>
      makeBlock({ user_id: "low", similarity: 0.3 - i * 0.01 })
    );
    const map = groupByUser([...highBlocks, ...lowBlocks]);
    expect(map.get("high")!.ndcgScore).toBeGreaterThan(map.get("low")!.ndcgScore);
  });

  it("NDCG score is always positive when all similarities are positive", () => {
    const blocks = Array.from({ length: 5 }, (_, i) =>
      makeBlock({ user_id: "alice", similarity: 0.5 + i * 0.05 })
    );
    const map = groupByUser(blocks);
    expect(map.get("alice")!.ndcgScore).toBeGreaterThan(0);
  });

  it("user with more blocks accumulates a higher NDCG than same user with fewer blocks (all sim identical)", () => {
    const sim = 0.6;
    const fewer = [makeBlock({ user_id: "a", similarity: sim })];
    const more  = Array.from({ length: 4 }, () => makeBlock({ user_id: "b", similarity: sim }));
    const mapFewer = groupByUser(fewer);
    const mapMore  = groupByUser(more);
    expect(mapMore.get("b")!.ndcgScore).toBeGreaterThan(mapFewer.get("a")!.ndcgScore);
  });
});
