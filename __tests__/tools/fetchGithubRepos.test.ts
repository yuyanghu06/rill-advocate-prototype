import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<{
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
}> = {}) {
  return {
    name: "my-repo",
    description: "A cool repo",
    html_url: "https://github.com/user/my-repo",
    language: "TypeScript",
    stargazers_count: 5,
    updated_at: "2024-06-01T00:00:00Z",
    fork: false,
    ...overrides,
  };
}

// Encode a string as base64 the way GitHub's API would
function toBase64(str: string) {
  return Buffer.from(str).toString("base64");
}

const USER_PROFILE = {
  login: "testuser",
  bio: "I build things",
  public_repos: 10,
};

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function mockFetch(
  profileStatus: number,
  repos: object[],
  readmeContent?: string | null
) {
  let callCount = 0;
  globalThis.fetch = (async (url: string) => {
    callCount++;
    const path = new URL(url as string).pathname;

    // User profile endpoint
    if (path.match(/^\/users\/[^/]+$/) && !path.includes("/repos")) {
      if (profileStatus === 404) {
        return new Response("{}", { status: 404 });
      }
      return new Response(JSON.stringify(USER_PROFILE), { status: 200 });
    }

    // Repos list endpoint
    if (path.includes("/repos") && !path.includes("/readme")) {
      return new Response(JSON.stringify(repos), { status: 200 });
    }

    // README endpoint
    if (path.includes("/readme")) {
      if (readmeContent === null) {
        return new Response("{}", { status: 404 });
      }
      const content = readmeContent ?? "# My Project\n\nA test readme.";
      return new Response(
        JSON.stringify({ content: toBase64(content) }),
        { status: 200 }
      );
    }

    return new Response("{}", { status: 404 });
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── Dynamic import after fetch is patchable ─────────────────────────────────

const { handleFetchGithubRepos } = await import("@/lib/tools/fetchGithubRepos");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleFetchGithubRepos", () => {

  // ── Error handling ─────────────────────────────────────────────────────────

  it("returns an error object when the GitHub user is not found (404)", async () => {
    mockFetch(404, []);
    const result = await handleFetchGithubRepos({ username: "nonexistent" });
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    expect(result.error).toContain("nonexistent");
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it("returns user profile fields on success", async () => {
    mockFetch(200, [makeRepo()]);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect(result.username).toBe(USER_PROFILE.login);
    expect(result.bio).toBe(USER_PROFILE.bio);
    expect(result.public_repos).toBe(USER_PROFILE.public_repos);
  });

  it("returns repos array with expected fields", async () => {
    const repo = makeRepo({ name: "cool-project", language: "Go", stargazers_count: 42 });
    mockFetch(200, [repo]);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect(result.repos).toHaveLength(1);
    expect(result.repos[0].name).toBe("cool-project");
    expect(result.repos[0].language).toBe("Go");
    expect(result.repos[0].stars).toBe(42);
    expect(result.repos[0].url).toBe(repo.html_url);
  });

  it("trims updated_at to YYYY-MM-DD", async () => {
    mockFetch(200, [makeRepo({ updated_at: "2024-09-15T12:34:56Z" })]);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect(result.repos[0].updated_at).toBe("2024-09-15");
  });

  // ── Fork filtering ─────────────────────────────────────────────────────────

  it("excludes forks with 10 or fewer stars", async () => {
    const repos = [
      makeRepo({ name: "original", fork: false }),
      makeRepo({ name: "fork-low-stars", fork: true, stargazers_count: 10 }),
      makeRepo({ name: "fork-zero-stars", fork: true, stargazers_count: 0 }),
    ];
    mockFetch(200, repos);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    const names = result.repos.map((r) => r.name);
    expect(names).toContain("original");
    expect(names).not.toContain("fork-low-stars");
    expect(names).not.toContain("fork-zero-stars");
  });

  it("keeps forks with more than 10 stars", async () => {
    const repos = [
      makeRepo({ name: "popular-fork", fork: true, stargazers_count: 11 }),
    ];
    mockFetch(200, repos);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect(result.repos.map((r) => r.name)).toContain("popular-fork");
  });

  // ── max_repos limit ────────────────────────────────────────────────────────

  it("returns no more repos than max_repos allows", async () => {
    const repos = Array.from({ length: 15 }, (_, i) =>
      makeRepo({ name: `repo-${i}` })
    );
    mockFetch(200, repos);
    const result = await handleFetchGithubRepos({ username: "testuser", max_repos: 5 });
    if ("error" in result) throw new Error(result.error);
    expect(result.repos.length).toBeLessThanOrEqual(5);
  });

  it("defaults to returning at most 10 repos when max_repos is not specified", async () => {
    const repos = Array.from({ length: 20 }, (_, i) =>
      makeRepo({ name: `repo-${i}` })
    );
    mockFetch(200, repos);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect(result.repos.length).toBeLessThanOrEqual(10);
  });

  // ── README enrichment ──────────────────────────────────────────────────────

  it("includes readme_excerpt for the first 3 repos", async () => {
    const repos = Array.from({ length: 5 }, (_, i) =>
      makeRepo({ name: `repo-${i}` })
    );
    mockFetch(200, repos, "# Readme content");
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect("readme_excerpt" in result.repos[0]).toBe(true);
    expect("readme_excerpt" in result.repos[1]).toBe(true);
    expect("readme_excerpt" in result.repos[2]).toBe(true);
  });

  it("does NOT include readme_excerpt for repos after the top 3", async () => {
    const repos = Array.from({ length: 5 }, (_, i) =>
      makeRepo({ name: `repo-${i}` })
    );
    mockFetch(200, repos, "# Readme content");
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect("readme_excerpt" in result.repos[3]).toBe(false);
    expect("readme_excerpt" in result.repos[4]).toBe(false);
  });

  it("truncates readme content to 1500 characters", async () => {
    const longReadme = "x".repeat(3000);
    mockFetch(200, [makeRepo()], longReadme);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    const excerpt = result.repos[0].readme_excerpt as string | undefined;
    expect(excerpt).toBeDefined();
    expect(excerpt!.length).toBe(1500);
  });

  it("omits readme_excerpt gracefully when the readme endpoint returns 404", async () => {
    mockFetch(200, [makeRepo()], null);
    const result = await handleFetchGithubRepos({ username: "testuser" });
    if ("error" in result) throw new Error(result.error);
    expect("readme_excerpt" in result.repos[0]).toBe(false);
  });
});
