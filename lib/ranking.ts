import type { ExperienceBlock } from "@/types";

const HELPER_URL_WEIGHT = 3;
const BLOCK_WEIGHT = 1;

/**
 * Computes a ranking score for a user profile.
 * Higher weight on helper URLs (harder to fake) vs raw block count.
 */
export function computeRankingScore(blocks: ExperienceBlock[]): number {
  const totalHelperUrls = blocks.reduce(
    (sum, b) => sum + b.helper_urls.length,
    0
  );
  const blockCount = blocks.length;
  return totalHelperUrls * HELPER_URL_WEIGHT + blockCount * BLOCK_WEIGHT;
}
