# Advocate Page — SKILL.md

## Overview

The **Advocate** page is a chat interface that lets a logged-in Rill user ask a conversational AI agent questions about themselves — their experiences, skills, projects, and linked resources. The agent retrieves the most semantically relevant context from Postgres before every LLM call and can redirect the user to a relevant helper or source URL via a dedicated tool.

---

## File Location

```
src/
└── pages/
    └── advocate/
        ├── index.tsx          # Page entry point
        ├── AdvocatePage.tsx   # Root component
        ├── ChatWindow.tsx     # Message list + scroll container
        ├── ChatInput.tsx      # Text input + send button
        ├── useChatStore.ts    # Zustand / context store for message history
        └── api/
            └── advocate.ts    # Server-side handler (embedding + LLM call)
prompts/
└── advocate.md                # System prompt (see §System Prompt Contract)
```

---

## Database Schema Assumptions

The skill assumes two Postgres tables already exist, both using `pgvector`:

### `experience_chunks`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → users |
| `embedded_text` | `text` | Raw text of the chunk |
| `embedding` | `vector(1536)` | OpenAI / compatible embedding |
| `source_url` | `text` | LinkedIn post, PDF, GitHub repo, etc. |
| `helper_urls` | `text[]` | Code repos, project links, Hackathon pages |
| `chunk_tree` | `jsonb` | Hierarchical section metadata |
| `created_at` | `timestamptz` | |

### `user_skills`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → users |
| `embedded_text` | `text` | Skill label + context |
| `embedding` | `vector(1536)` | |
| `source_url` | `text` | Where this skill was inferred from |
| `helper_urls` | `text[]` | |
| `created_at` | `timestamptz` | |

> **Vector index:** Both tables should have an `ivfflat` or `hnsw` index on the `embedding` column for fast ANN search.

---

## Retrieval Logic (K=5 per table)

Before every LLM call, embed the user's latest message and run two parallel nearest-neighbor queries:

```sql
-- experiences
SELECT id, embedded_text, source_url, helper_urls, chunk_tree
FROM experience_chunks
WHERE user_id = $1
ORDER BY embedding <=> $2          -- cosine distance operator (pgvector)
LIMIT 5;

-- skills
SELECT id, embedded_text, source_url, helper_urls
FROM user_skills
WHERE user_id = $1
ORDER BY embedding <=> $2
LIMIT 5;
```

Collect all unique `helper_urls` and `source_url` values from both result sets — these are the candidate URLs available to the `redirect` tool.

---

## Context Assembly

Construct the RAG context block injected into the system prompt at runtime:

```
--- RETRIEVED CONTEXT ---

### Relevant Experiences (top 5)
1. {embedded_text}
   Source: {source_url}
   Helpers: {helper_urls joined by ", "}

... (up to 5)

### Relevant Skills (top 5)
1. {embedded_text}
   Source: {source_url}
   Helpers: {helper_urls joined by ", "}

... (up to 5)

### Available URLs for redirect tool
{de-duplicated list of all source_url + helper_urls from above results}
-------------------------
```

Append this block after the static contents of `prompts/advocate.md` before sending to the LLM.

---

## System Prompt Contract

The static portion of the system prompt lives in `prompts/advocate.md`.

**Required sections in `prompts/advocate.md`:**
- Role definition — who the agent is and what it knows
- Tone guidance — conversational, first-person ("you"), non-robotic
- Scope constraints — only answer questions about the user; decline unrelated requests graciously
- Tool usage policy — when and how to invoke `redirect` (see below)
- A clear placeholder `{{RETRIEVED_CONTEXT}}` marking where the dynamic RAG block is injected at runtime

**Example skeleton:**
```markdown
You are Advocate, a personal AI assistant on the Rill platform...

You have access to the user's retrieved experiences and skills below.
Answer questions about the user in a warm, confident, first-person voice...

{{RETRIEVED_CONTEXT}}

When you believe a source URL or helper URL would meaningfully help the user
explore a topic further, call the `redirect` tool with that URL...
```

---

## LLM Tool: `redirect`

The LLM is given exactly **one tool**.

### Tool Definition

```json
{
  "name": "redirect",
  "description": "Opens a new browser tab and navigates the user to a URL. Use this when a helper URL or source URL from the retrieved context would give the user meaningful additional information — for example, a GitHub repo for a project they asked about, a LinkedIn post, or a Hackathon showcase page. Only call this tool with URLs that appear in the retrieved context; do not fabricate URLs.",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The fully-qualified URL to open. Must be one of the URLs present in the retrieved context."
      },
      "reason": {
        "type": "string",
        "description": "A one-sentence explanation shown to the user in the chat before the tab opens (e.g. 'Opening your GitHub repo for Project Atlas')."
      }
    },
    "required": ["url", "reason"]
  }
}
```

### Client-Side Tool Execution

When the LLM response contains a `tool_use` block with `name: "redirect"`:

1. Display `reason` as a system message in the chat (e.g. in a distinct style — italic, muted color).
2. Call `window.open(url, '_blank', 'noopener,noreferrer')`.
3. Do **not** end the turn — continue streaming/displaying the remainder of the LLM response as the assistant message.

```typescript
// pseudo-code
if (block.type === 'tool_use' && block.name === 'redirect') {
  const { url, reason } = block.input;
  appendSystemMessage(`↗ ${reason}`);
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

---

## API Handler (`api/advocate.ts`)

```
POST /api/advocate
Authorization: Bearer <session token>

Body: {
  userId: string,
  message: string,
  history: { role: 'user' | 'assistant', content: string }[]
}
```

**Steps:**
1. Authenticate the request; extract `userId`.
2. Embed `message` using the project's embedding model (same model used at ingestion time).
3. Run the two Postgres KNN queries (K=5 each) scoped to `userId`.
4. Build the context block; inject into `prompts/advocate.md` at `{{RETRIEVED_CONTEXT}}`.
5. Call the LLM with:
   - `system`: assembled prompt
   - `messages`: `[...history, { role: 'user', content: message }]`
   - `tools`: `[redirect tool definition]`
   - `tool_choice`: `"auto"`
6. Stream the response back to the client.
7. The client renders text blocks inline and executes `redirect` tool calls client-side.

---

## Chat UI Behaviour

| Concern | Spec |
|---|---|
| Message history | Maintained in client state; full history sent on every request |
| Streaming | Use SSE or chunked transfer; render assistant tokens as they arrive |
| Tool message style | Displayed as a distinct "system" bubble (e.g. muted/italic), not as an assistant message |
| Empty state | Show a prompt suggestion like *"Ask me about your projects, skills, or experiences"* |
| Loading state | Show a typing indicator while awaiting the first token |
| Error state | Display an inline error message; allow retry |
| Scroll | Auto-scroll to the latest message; preserve scroll position if user scrolls up |

---

## Security Notes

- The Postgres queries are always scoped to the authenticated `userId` — a user can only retrieve their own embeddings.
- The `redirect` tool must only fire on URLs present in the retrieved context for that request. The client should validate the URL against the returned context before opening.
- Do not expose raw embeddings or internal chunk IDs in the API response.

---

## Dependencies

| Package | Purpose |
|---|---|
| `pgvector` | Postgres vector extension + Node client support |
| `openai` (or equivalent) | Embedding generation + LLM calls |
| `pg` / `postgres` | Postgres client |
| `@anthropic-ai/sdk` (if using Claude) | LLM SDK |

---

## Related Files

- `prompts/advocate.md` — static system prompt (must contain `{{RETRIEVED_CONTEXT}}` placeholder)
- `SKILL.md` (onboarding) — describes how experience chunks and skills are ingested
- `experience_chunks` and `user_skills` tables — data source for retrieval