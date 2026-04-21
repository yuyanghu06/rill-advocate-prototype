import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";
import type { DiscoverCandidate, DiscoverFilters, ExperienceBlock } from "@/types";

const BETA = 0.2; // ranking boost weight
const DEFAULT_ALPHA = 0.65;
const DEFAULT_PAGE_SIZE = 20;
const K_BLOCKS_PER_USER = 5; // top-k embedding matches kept per user

/**
 * POST /api/discover/search
 *
 * Hybrid recruiter search: semantic (pgvector cosine) + keyword (in-memory term
 * frequency) combined via Reciprocal Rank Fusion, then boosted by user_ranking.
 *
 * Body: {
 *   query:      string
 *   filters?:   { skills, min_ranking, has_github, has_linkedin }
 *   alpha?:     number   // semantic weight [0..1], default 0.65
 *   sort?:      "best_match" | "most_credible" | "most_experience" | "most_verified"
 *   page?:      number
 *   page_size?: number
 * }
 */
export async function POST(req: NextRequest) {
  const {
    query = "",
    filters = {} as Partial<DiscoverFilters>,
    alpha = DEFAULT_ALPHA,
    sort = "best_match",
    page = 1,
    page_size = DEFAULT_PAGE_SIZE,
  } = await req.json();

  const supabase = getServerClient();

  // ── Semantic pass ──────────────────────────────────────────────────────────
  type BlockWithSim = ExperienceBlock & { similarity: number };
  const semanticByUser = new Map<
    string,
    { blocks: BlockWithSim[]; topSim: number; ndcgScore: number }
  >();

  if (query.trim()) {
    const queryEmbedding = await embedText(query);

    // Pull a large pool so every user is likely to have K_BLOCKS_PER_USER
    // represented even when there are many candidates.
    const { data: matched, error } = await supabase.rpc(
      "match_experience_blocks",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 600,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by user; blocks arrive sorted by similarity desc from pgvector
    for (const block of matched ?? []) {
      const entry = semanticByUser.get(block.user_id);
      if (entry) {
        if (entry.blocks.length < K_BLOCKS_PER_USER) {
          entry.blocks.push(block);
          entry.topSim = Math.max(entry.topSim, block.similarity);
        }
      } else {
        semanticByUser.set(block.user_id, {
          blocks: [block],
          topSim: block.similarity,
          ndcgScore: 0,
        });
      }
    }

    // NDCG-weighted semantic score per user (top-K chunks, log-decay by rank)
    for (const entry of semanticByUser.values()) {
      const sims = entry.blocks.map((b) => b.similarity); // already top-K, desc
      entry.ndcgScore = sims.reduce(
        (sum, sim, k) => sum + sim / Math.log2(k + 2),
        0
      );
    }
  }

  // ── Fetch all profiles ─────────────────────────────────────────────────────
  // Fetched up-front so keyword matching can expand the pool beyond semantic hits.
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select(
      "user_id, ranking_score, display_name, headline, top_skills, capability_bullets, skills, helper_url_count, avatar_url"
    )
    .eq("is_visible", true)
    .eq("is_recruiter", false)
    .limit(500);

  const profileMap = new Map(
    (profiles ?? []).map((p: {
      user_id: string;
      ranking_score: number;
      display_name: string | null;
      headline: string | null;
      top_skills: string[] | null;
      capability_bullets: string[] | null;
      skills: Record<string, number> | null;
      helper_url_count: number | null;
      avatar_url: string | null;
    }) => [p.user_id, p])
  );

  // ── Keyword scoring (in-memory) ────────────────────────────────────────────
  const queryTerms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t: string) => t.length > 2); // skip stop-word-length tokens

  // ── User pool ──────────────────────────────────────────────────────────────
  // Union of: semantic matches + profiles whose skills/headline match query terms.
  // This ensures keyword-only matches (no embeddings) still surface.
  let userIds: string[];
  if (query.trim()) {
    const semanticIds = new Set(semanticByUser.keys());
    if (queryTerms.length) {
      for (const profile of profiles ?? []) {
        const skillCorpus = [
          ...(profile.top_skills ?? []),
          ...Object.keys(profile.skills ?? {}),
          profile.headline ?? "",
        ].join(" ").toLowerCase();
        if (queryTerms.some((t: string) => skillCorpus.includes(t))) {
          semanticIds.add(profile.user_id);
        }
      }
    }
    // Only keep users whose profiles are visible (profileMap excludes is_visible=false)
    userIds = Array.from(semanticIds).filter((id) => profileMap.has(id));
  } else {
    userIds = (profiles ?? []).map((p: { user_id: string }) => p.user_id);
  }

  if (!userIds.length) {
    return NextResponse.json({ total: 0, page, results: [] });
  }

  const maxNdcg = Math.max(
    ...Array.from(semanticByUser.values()).map((e) => e.ndcgScore),
    1
  );

  function computeKeywordScore(userId: string): number {
    if (!queryTerms.length) return 0;
    const entry = semanticByUser.get(userId);
    const profile = profileMap.get(userId);
    // Corpus: block text + top_skills array + all keys from skills JSONB map + headline
    const skillsMapKeys = Object.keys(profile?.skills ?? {});
    const corpus = [
      ...(entry?.blocks.map(
        (b) => `${b.title ?? ""} ${b.embedded_text ?? ""}`
      ) ?? []),
      ...(profile?.top_skills ?? []),
      ...skillsMapKeys,
      profile?.headline ?? "",
    ]
      .join(" ")
      .toLowerCase();

    let hits = 0;
    for (const term of queryTerms) {
      const count = (corpus.match(new RegExp(term, "g")) ?? []).length;
      hits += Math.min(count, 5); // cap per-term to avoid stuffing
    }
    return hits / (queryTerms.length * 5); // normalise to [0,1]
  }

  // ── Score fusion + boost ───────────────────────────────────────────────────
  const rawCandidates: DiscoverCandidate[] = userIds.map((userId) => {
    const entry = semanticByUser.get(userId);
    const profile = profileMap.get(userId);

    const normSemantic = entry ? entry.ndcgScore / maxNdcg : 0;
    const kwScore = computeKeywordScore(userId);
    const fusedScore = alpha * normSemantic + (1 - alpha) * kwScore;
    const rankingScore = profile?.ranking_score ?? 0;
    const finalScore = fusedScore * (1 + BETA * Math.log1p(rankingScore));

    return {
      user_id: userId,
      display_name: profile?.display_name ?? undefined,
      headline: profile?.headline ?? undefined,
      top_skills: profile?.top_skills ?? [],
      capability_bullets: profile?.capability_bullets ?? [],
      helper_url_count: profile?.helper_url_count ?? 0,
      ranking_score: rankingScore,
      matching_blocks: entry?.blocks ?? [],
      similarity: entry?.topSim ?? 0,
      keyword_score: kwScore,
      semantic_score: normSemantic,
      final_score: finalScore,
      avatar_url: profile?.avatar_url ?? undefined,
    };
  });

  // ── Apply filters ──────────────────────────────────────────────────────────
  let results = rawCandidates;

  if (filters.min_ranking) {
    results = results.filter((c) => c.ranking_score >= filters.min_ranking!);
  }
  if (filters.skills?.length) {
    results = results.filter((c) =>
      filters.skills!.every((skill: string) =>
        (c.top_skills ?? []).some((s) =>
          s.toLowerCase().includes(skill.toLowerCase())
        )
      )
    );
  }
  if (filters.has_github) {
    results = results.filter((c) =>
      c.matching_blocks.some((b) =>
        (b.helper_urls ?? []).some((u) => u.includes("github.com"))
      )
    );
  }
  if (filters.has_linkedin) {
    results = results.filter((c) =>
      c.matching_blocks.some((b) =>
        (b.helper_urls ?? []).some((u) => u.includes("linkedin.com"))
      )
    );
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sortFns: Record<string, (a: DiscoverCandidate, b: DiscoverCandidate) => number> = {
    best_match: (a, b) => (b.final_score ?? 0) - (a.final_score ?? 0),
    most_credible: (a, b) => b.ranking_score - a.ranking_score,
    most_experience: (a, b) => b.matching_blocks.length - a.matching_blocks.length,
    most_verified: (a, b) => (b.helper_url_count ?? 0) - (a.helper_url_count ?? 0),
  };
  results.sort(sortFns[sort] ?? sortFns.best_match);

  // ── Paginate ───────────────────────────────────────────────────────────────
  const total = results.length;
  const start = (page - 1) * page_size;
  const paginated = results.slice(start, start + page_size);

  return NextResponse.json({ total, page, results: paginated });
}
