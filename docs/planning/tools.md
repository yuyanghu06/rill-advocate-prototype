# Advocate — Tool Use Spec

This file defines all Claude API tools used in the Advocate onboarding agent.
Each tool is defined with its name, purpose, input schema, expected output, and implementation notes.

Claude Code should use this file as the source of truth when building the tool use layer.

---

## Overview

Tools are passed as JSON in every Claude API call from `app/api/advocate/route.ts`.
Claude decides when to call them mid-conversation. The route handler intercepts `tool_use`
blocks in Claude's response, executes the corresponding logic, and feeds results back
into the conversation as `tool_result` blocks.

All tools live in `lib/tools/` — one file per tool, with a central `lib/tools/index.ts`
that exports the JSON schema array to pass to the API.

---

## File Structure

```
lib/
└── tools/
    ├── index.ts                  ← exports full tools array for Claude API calls
    ├── saveExperienceBlock.ts    ← writes experience block to Supabase
    ├── fetchGithubRepos.ts       ← calls GitHub REST API for a given username
    └── redirectUser.ts           ← returns a URL for the frontend to redirect to
```

---

## Tool Definitions

---

### 1. `save_experience_block`

**Purpose:**
Parses a resume (provided as extracted text) and writes one or more structured
experience blocks to Supabase. Each distinct job, project, or experience in the
resume becomes its own block.

**When Claude calls this:**
After the user uploads a resume and Claude has extracted and confirmed the experience
blocks with the user during onboarding.

**Input Schema:**
```json
{
  "name": "save_experience_block",
  "description": "Save a structured experience block to the database after extracting it from a resume or other source. Call this once per block — do not batch multiple experiences into one call.",
  "input_schema": {
    "type": "object",
    "properties": {
      "user_id": {
        "type": "string",
        "description": "The authenticated user's ID from Supabase Auth"
      },
      "title": {
        "type": "string",
        "description": "Short title of the experience, e.g. 'Software Engineer Intern at Stripe'"
      },
      "overview": {
        "type": "string",
        "description": "2-3 sentence summary of the experience written by the model"
      },
      "source_type": {
        "type": "string",
        "enum": ["resume", "linkedin", "github", "manual"],
        "description": "The source this block was derived from"
      },
      "source_url": {
        "type": "string",
        "description": "URL or filename of the original source (e.g. resume PDF name, LinkedIn export filename)"
      },
      "helper_urls": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Any supporting URLs for this block — repos, project links, demos, etc."
      },
      "date_range": {
        "type": "string",
        "description": "Date range of the experience if available, e.g. 'Jun 2022 – Aug 2022'"
      }
    },
    "required": ["user_id", "title", "overview", "source_type"]
  }
}
```

**Expected Output (returned to Claude):**
```json
{
  "success": true,
  "block_id": "uuid",
  "message": "Experience block saved successfully."
}
```

**Implementation Notes (`lib/tools/saveExperienceBlock.ts`):**
- Insert a new row into the `experience_blocks` table in Supabase
- After inserting, generate an embedding for the `overview` field using OpenAI embeddings
- Store the embedding in the `raw_embedding` column (pgvector `vector` type)
- If `helper_urls` is empty, still save the block — helper URLs can be added later
- Return the new `block_id` so Claude can reference it in follow-up steps

---

### 2. `fetch_github_repos`

**Purpose:**
Calls the GitHub REST API for a given username and returns a structured summary
of their public repositories. Claude uses this to automatically create experience
blocks from a user's GitHub profile without any manual input.

**When Claude calls this:**
When the user provides a GitHub profile URL during onboarding source collection.

**Input Schema:**
```json
{
  "name": "fetch_github_repos",
  "description": "Fetch public repositories and profile info for a GitHub user. Extract the username from the provided GitHub profile URL before calling this tool.",
  "input_schema": {
    "type": "object",
    "properties": {
      "username": {
        "type": "string",
        "description": "The GitHub username extracted from the profile URL, e.g. 'torvalds' from 'https://github.com/torvalds'"
      },
      "max_repos": {
        "type": "number",
        "description": "Maximum number of repos to return, sorted by most recently updated. Defaults to 10.",
        "default": 10
      }
    },
    "required": ["username"]
  }
}
```

**Expected Output (returned to Claude):**
```json
{
  "username": "torvalds",
  "bio": "...",
  "repos": [
    {
      "name": "repo-name",
      "description": "repo description",
      "url": "https://github.com/username/repo-name",
      "language": "TypeScript",
      "stars": 42,
      "updated_at": "2024-03-01"
    }
  ]
}
```

**Implementation Notes (`lib/tools/fetchGithubRepos.ts`):**
- Call `https://api.github.com/users/{username}` for profile info
- Call `https://api.github.com/users/{username}/repos?sort=updated&per_page={max_repos}` for repos
- Include an `Authorization: Bearer {GITHUB_TOKEN}` header using `process.env.GITHUB_TOKEN` to avoid rate limiting. If no token is set, proceed unauthenticated (60 req/hour limit)
- Also fetch the README for the top 3 repos via `https://api.github.com/repos/{username}/{repo}/readme` and include decoded content — this gives Claude richer context to write experience block overviews
- Filter out forked repos by default (`fork: false`) unless they have significant star count (>10)
- Return a clean structured object — do not return raw GitHub API response

---

### 3. `redirect_user`

**Purpose:**
Returns a URL that the frontend should navigate the user to. Used when the agent
needs the user to take an external action — like exporting their LinkedIn data,
visiting a project link, or connecting a third-party service.

This tool does not navigate the user itself — it signals the frontend to do so.

**When Claude calls this:**
- When Claude asks the user to export their LinkedIn archive and needs to send them to the right LinkedIn settings page
- When Claude wants to show the user one of their helper URLs
- Any time during onboarding where the user needs to visit an external link to continue

**Input Schema:**
```json
{
  "name": "redirect_user",
  "description": "Signal the frontend to redirect or open a URL for the user. Use this when the user needs to visit an external page to complete a step — like downloading their LinkedIn export. Do not use this for internal app navigation.",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The full URL to redirect the user to"
      },
      "label": {
        "type": "string",
        "description": "Short human-readable label for the link shown in the UI, e.g. 'Export LinkedIn Data'"
      },
      "reason": {
        "type": "string",
        "description": "One sentence explaining why the user is being redirected, shown as a message in the chat before the link appears"
      },
      "open_in_new_tab": {
        "type": "boolean",
        "description": "Whether to open the URL in a new tab instead of navigating away. Defaults to true.",
        "default": true
      }
    },
    "required": ["url", "label", "reason"]
  }
}
```

**Expected Output (returned to Claude):**
```json
{
  "success": true,
  "message": "Redirect signal sent to frontend."
}
```

**Implementation Notes (`lib/tools/redirectUser.ts`):**
- This tool does not make any HTTP calls — it is purely a signal
- The route handler should detect this tool call and emit a special event in the SSE stream that the frontend listens for
- The frontend (`components/chat/ChatWindow.tsx`) should handle the redirect event by rendering a styled link button in the chat (not an automatic redirect) so the user is in control
- Preset URLs to hardcode as named constants in the file:
  ```typescript
  export const REDIRECT_PRESETS = {
    LINKEDIN_EXPORT: "https://www.linkedin.com/mypreferences/d/download-my-data",
    GITHUB_PROFILE: "https://github.com/",
  }
  ```

---

## Central Index (`lib/tools/index.ts`)

Export the tools array to pass directly into Claude API calls:

```typescript
import { saveExperienceBlockTool } from "./saveExperienceBlock";
import { fetchGithubReposTool } from "./fetchGithubRepos";
import { redirectUserTool } from "./redirectUser";

export const advocateTools = [
  saveExperienceBlockTool,
  fetchGithubReposTool,
  redirectUserTool,
];
```

Then in `app/api/advocate/route.ts`:

```typescript
import { advocateTools } from "@/lib/tools";

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  tools: advocateTools,
  messages: conversationHistory,
});
```

---

## Tool Result Handling

In `app/api/advocate/route.ts`, after receiving Claude's response check for `tool_use` blocks and handle each:

```typescript
for (const block of response.content) {
  if (block.type === "tool_use") {
    switch (block.name) {
      case "save_experience_block":
        result = await handleSaveExperienceBlock(block.input);
        break;
      case "fetch_github_repos":
        result = await handleFetchGithubRepos(block.input);
        break;
      case "redirect_user":
        result = await handleRedirectUser(block.input);
        break;
    }
    // Feed result back into conversation
    conversationHistory.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result)
      }]
    });
  }
}
```