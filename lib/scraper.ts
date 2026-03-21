/**
 * Source extraction helpers.
 * At MVP scale these are thin wrappers — real scraping of live LinkedIn/GitHub
 * URLs is deferred (out of scope per CLAUDE.md). These functions process
 * pasted text or publicly accessible raw content.
 */

export type RawSource = {
  type: "resume" | "linkedin" | "github" | "other";
  text: string;
  url?: string;
};

/**
 * Fetches raw text from a GitHub profile or repo README.
 * Only hits unauthenticated public endpoints.
 */
export async function fetchGitHubReadme(
  username: string
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${username}/${username}/main/README.md`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

/**
 * Extracts a GitHub username from a profile URL.
 * e.g. "https://github.com/torvalds" → "torvalds"
 */
export function parseGitHubUsername(url: string): string | null {
  const match = url.match(/github\.com\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Strips common resume boilerplate and normalises whitespace.
 */
export function cleanResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
