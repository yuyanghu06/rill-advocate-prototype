import { describe, it, expect, mock } from "bun:test";

// ─── Mock all three handlers ──────────────────────────────────────────────────
// We test the dispatcher in isolation — handler correctness is covered in their
// own test files.

const SAVE_RESULT = { success: true, block_id: "block-xyz", message: "saved" };
const GITHUB_RESULT = { username: "alice", bio: null, public_repos: 3, repos: [] };
const REDIRECT_RESULT = {
  success: true as const,
  message: "Redirect signal sent to frontend.",
  redirect: {
    url: "https://linkedin.com/export",
    label: "Export",
    reason: "We need your data.",
    open_in_new_tab: true,
  },
};

mock.module("@/lib/tools/saveExperienceBlock", () => ({
  saveExperienceBlockTool: {},
  handleSaveExperienceBlock: mock(async () => SAVE_RESULT),
}));

mock.module("@/lib/tools/fetchGithubRepos", () => ({
  fetchGithubReposTool: {},
  handleFetchGithubRepos: mock(async () => GITHUB_RESULT),
}));

mock.module("@/lib/tools/redirectUser", () => ({
  redirectUserTool: {},
  handleRedirectUser: mock(() => REDIRECT_RESULT),
  REDIRECT_MARKER_PREFIX: "\x00REDIRECT:",
  REDIRECT_MARKER_SUFFIX: "\x00",
}));

const { executeTool } = await import("@/lib/tools/index");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("executeTool dispatcher", () => {
  const USER_ID = "user-123";

  // ── save_experience_block ──────────────────────────────────────────────────

  it("routes save_experience_block to handleSaveExperienceBlock", async () => {
    const { result } = await executeTool(
      "save_experience_block",
      { title: "Engineer", overview: "Did stuff.", source_type: "resume" },
      USER_ID
    );
    expect(result).toEqual(SAVE_RESULT);
  });

  it("injects the userId from executeTool into the save_experience_block call", async () => {
    // The dispatcher does { ...input, user_id: userId } so the handler
    // always receives the server-resolved userId, not whatever Claude passed.
    const { handleSaveExperienceBlock } = await import(
      "@/lib/tools/saveExperienceBlock"
    );
    await executeTool(
      "save_experience_block",
      { title: "Engineer", overview: "Did stuff.", source_type: "resume" },
      USER_ID
    );
    const callArg = (handleSaveExperienceBlock as ReturnType<typeof mock>).mock
      .calls.at(-1)?.[0] as Record<string, unknown>;
    expect(callArg?.user_id).toBe(USER_ID);
  });

  it("does not include a redirect in the result for save_experience_block", async () => {
    const out = await executeTool("save_experience_block", {}, USER_ID);
    expect(out.redirect).toBeUndefined();
  });

  // ── fetch_github_repos ─────────────────────────────────────────────────────

  it("routes fetch_github_repos to handleFetchGithubRepos", async () => {
    const { result } = await executeTool(
      "fetch_github_repos",
      { username: "alice" },
      USER_ID
    );
    expect(result).toEqual(GITHUB_RESULT);
  });

  it("does not include a redirect in the result for fetch_github_repos", async () => {
    const out = await executeTool("fetch_github_repos", { username: "alice" }, USER_ID);
    expect(out.redirect).toBeUndefined();
  });

  // ── redirect_user ──────────────────────────────────────────────────────────

  it("routes redirect_user to handleRedirectUser", async () => {
    const { result } = await executeTool(
      "redirect_user",
      { url: "https://linkedin.com/export", label: "Export", reason: "Need data." },
      USER_ID
    );
    expect(result).toEqual(REDIRECT_RESULT);
  });

  it("surfaces the redirect payload on the top-level result for redirect_user", async () => {
    const { redirect } = await executeTool(
      "redirect_user",
      { url: "https://linkedin.com/export", label: "Export", reason: "Need data." },
      USER_ID
    );
    expect(redirect).toEqual(REDIRECT_RESULT.redirect);
  });

  // ── unknown tool ───────────────────────────────────────────────────────────

  it("returns an error object for an unknown tool name", async () => {
    const { result } = await executeTool("nonexistent_tool", {}, USER_ID);
    expect((result as Record<string, unknown>).error).toContain("nonexistent_tool");
  });
});
