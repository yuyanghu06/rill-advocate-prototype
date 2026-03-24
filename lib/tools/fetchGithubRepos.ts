import type Anthropic from "@anthropic-ai/sdk";

export const fetchGithubReposTool: Anthropic.Tool = {
  name: "fetch_github_repos",
  description:
    "Fetch public repositories and profile info for a GitHub user. Extract the username from the provided GitHub profile URL before calling this tool.",
  input_schema: {
    type: "object",
    properties: {
      username: {
        type: "string",
        description:
          "The GitHub username extracted from the profile URL, e.g. 'torvalds' from 'https://github.com/torvalds'",
      },
      max_repos: {
        type: "number",
        description:
          "Maximum number of repos to return, sorted by most recently updated. Defaults to 10.",
      },
    },
    required: ["username"],
  },
};

type GitHubRepo = {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  fork: boolean;
};

type GitHubUser = {
  login: string;
  bio: string | null;
  public_repos: number;
};

type FetchInput = { username: string; max_repos?: number };

async function ghFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

async function fetchReadme(username: string, repo: string): Promise<string | null> {
  const res = await ghFetch(`/repos/${username}/${repo}/readme`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.content) return null;
  return Buffer.from(data.content, "base64").toString("utf-8").slice(0, 1500);
}

export async function handleFetchGithubRepos(input: FetchInput) {
  const { username, max_repos = 10 } = input;

  const [profileRes, reposRes] = await Promise.all([
    ghFetch(`/users/${username}`),
    ghFetch(`/users/${username}/repos?sort=updated&per_page=${max_repos + 5}`),
  ]);

  if (!profileRes.ok) {
    return { error: `GitHub user '${username}' not found.` };
  }

  const profile: GitHubUser = await profileRes.json();
  const rawRepos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];

  // Filter forks unless they have significant stars
  const repos = rawRepos
    .filter((r) => !r.fork || r.stargazers_count > 10)
    .slice(0, max_repos);

  // Fetch READMEs for the top 3 repos for richer context
  const top3 = repos.slice(0, 3);
  const readmes = await Promise.all(
    top3.map((r) => fetchReadme(username, r.name))
  );

  return {
    username: profile.login,
    bio: profile.bio,
    public_repos: profile.public_repos,
    repos: repos.map((r, i) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      updated_at: r.updated_at.slice(0, 10),
      ...(i < 3 && readmes[i] ? { readme_excerpt: readmes[i] } : {}),
    })),
  };
}
