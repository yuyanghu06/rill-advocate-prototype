import { describe, it, expect } from "bun:test";
import { computeRankingScore } from "../../lib/ranking";
import type { ExperienceBlock } from "../../types";

function makeBlock(overrides: Partial<ExperienceBlock> = {}): ExperienceBlock {
  return {
    block_id: crypto.randomUUID(),
    user_id: "user-1",
    title: "Engineer at Acme",
    overview: "Built things.",
    embedded_text: "Engineer at Acme Built things.",
    source_type: "resume",
    source_url: "",
    helper_urls: [],
    ...overrides,
  };
}

describe("computeRankingScore", () => {
  it("returns 0 for an empty block list", () => {
    expect(computeRankingScore([])).toBe(0);
  });

  it("scores 1 point per block when no helper URLs are present", () => {
    const blocks = [makeBlock(), makeBlock(), makeBlock()];
    expect(computeRankingScore(blocks)).toBe(3);
  });

  it("scores 3 points per helper URL", () => {
    const blocks = [makeBlock({ helper_urls: ["https://github.com/repo"] })];
    // 1 block × 1pt + 1 helper × 3pt = 4
    expect(computeRankingScore(blocks)).toBe(4);
  });

  it("accumulates helper URLs across multiple blocks", () => {
    const blocks = [
      makeBlock({ helper_urls: ["https://github.com/a", "https://demo.com"] }),
      makeBlock({ helper_urls: ["https://github.com/b"] }),
      makeBlock(), // no helper URLs
    ];
    // 3 blocks × 1pt + 3 helpers × 3pt = 12
    expect(computeRankingScore(blocks)).toBe(12);
  });

  it("weights helper URLs (3×) higher than block count (1×)", () => {
    const oneBlockWithUrls = [
      makeBlock({ helper_urls: ["https://a.com", "https://b.com"] }),
    ];
    const twoBlocksNoUrls = [makeBlock(), makeBlock()];

    // 1 + 6 = 7  vs  2
    expect(computeRankingScore(oneBlockWithUrls)).toBeGreaterThan(
      computeRankingScore(twoBlocksNoUrls)
    );
  });
});
