import { saveExperienceBlockTool, handleSaveExperienceBlock } from "./saveExperienceBlock";
import { updateExperienceBlockTool, handleUpdateExperienceBlock } from "./updateExperienceBlock";
import { upsertSkillsTool, handleUpsertSkills } from "./upsertSkills";
import { fetchGithubReposTool, handleFetchGithubRepos } from "./fetchGithubRepos";
import { redirectUserTool, handleRedirectUser, type RedirectPayload } from "./redirectUser";
import type Anthropic from "@anthropic-ai/sdk";

export { handleSaveExperienceBlock, handleUpdateExperienceBlock, handleUpsertSkills, handleFetchGithubRepos, handleRedirectUser };
export type { RedirectPayload };

export const advocateTools: Anthropic.Tool[] = [
  saveExperienceBlockTool,
  updateExperienceBlockTool,
  upsertSkillsTool,
  fetchGithubReposTool,
  redirectUserTool,
];

// Dispatch a tool_use block to its handler.
// Returns the result object and, for redirect_user, a populated `redirect` field.
export async function executeTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  userId: string
): Promise<{ result: object; redirect?: RedirectPayload }> {
  console.log(`[tool_use] ${name}`, JSON.stringify(input, null, 2));
  switch (name) {
    case "save_experience_block":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { result: await handleSaveExperienceBlock({ ...(input as any), user_id: userId }) };

    case "update_experience_block":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { result: await handleUpdateExperienceBlock({ ...(input as any), user_id: userId }) };

    case "upsert_skills":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { result: await handleUpsertSkills({ ...(input as any), user_id: userId }) };

    case "fetch_github_repos":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { result: await handleFetchGithubRepos(input as any) };

    case "redirect_user": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = handleRedirectUser(input as any);
      return { result: out, redirect: out.redirect };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
