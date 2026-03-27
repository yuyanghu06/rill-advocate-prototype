# Rill Advocate

## Overview

Advocate is an intelligent onboarding agent and talent search platform for the Rill recruiting marketplace. It guides new users through building a rich, structured profile by extracting and organizing their experiences from resumes, LinkedIn, GitHub, and other sources. Recruiters can then search the talent pool using natural language, with results ranked by profile completeness and verifiability.

The platform has two primary personas:
- **Candidates** — interact with the Advocate agent to build their profile through conversation
- **Recruiters** — use the Discover page to search and query candidates with hybrid semantic + keyword search

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Deployment | Vercel |
| Styling | Tailwind CSS |
| Agent / LLM | Claude API (`claude-sonnet-4-6`) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Primary Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Session Cache | Upstash Redis |

---

## Project Structure

```
rill-advocate/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                            # Landing / entry point
│   ├── onboarding/page.tsx                 # Onboarding chat UI (Advocate agent)
│   ├── advocate/page.tsx                   # Advocate RAG chat (self-mode + recruiter mode)
│   ├── discover/page.tsx                   # Recruiter talent search UI
│   ├── profile/[userId]/page.tsx           # Public candidate profile view
│   ├── settings/page.tsx                   # User settings
│   ├── auth/
│   │   ├── page.tsx                        # Sign-in / sign-up form
│   │   ├── callback/route.ts               # OAuth / magic-link callback handler
│   │   └── signout/route.ts                # Sign-out POST handler
│   └── api/
│       ├── advocate/
│       │   ├── route.ts                    # Onboarding agent — streaming agentic loop
│       │   └── chat/route.ts               # RAG chat agent (Advocate page)
│       ├── discover/search/route.ts        # Hybrid semantic + keyword recruiter search
│       ├── onboarding/
│       │   ├── session/route.ts            # Read/write Redis onboarding session
│       │   └── finalize/route.ts           # Flush session to Supabase on completion
│       ├── profile/[userId]/route.ts       # Fetch finalized profile blocks + headline
│       ├── embed/route.ts                  # Generate + store OpenAI embeddings
│       └── upload/resume/route.ts          # Resume file upload handler
├── components/
│   ├── auth/AuthForm.tsx                   # Sign-in / sign-up form component
│   ├── chat/
│   │   ├── AdvocateChatWindow.tsx          # RAG chat UI (Advocate page)
│   │   ├── ChatWindow.tsx                  # Onboarding chat UI
│   │   ├── MessageBubble.tsx               # Individual chat message renderer
│   │   └── SourceUploader.tsx              # Resume / URL input during onboarding
│   ├── dashboard/Sidebar.tsx               # App sidebar nav
│   ├── discover/DiscoverSearch.tsx         # Discover page search + filters + results
│   ├── onboarding/
│   │   ├── ExperienceBlockList.tsx         # Live block list shown during onboarding
│   │   └── SkillsList.tsx                  # Skills display on profile page
│   ├── profile/
│   │   ├── ExperienceBlock.tsx             # Single experience block display
│   │   ├── ProfilePopup.tsx                # Inline profile modal (used on Advocate page)
│   │   └── RankingBadge.tsx                # Credibility tier badge (Building / Good / Strong / Elite)
│   └── recruiter/CandidateCard.tsx         # Search result card for a candidate
├── lib/
│   ├── claude.ts                           # Claude API client + system prompt loader
│   ├── supabase.ts                         # Supabase browser client
│   ├── supabase.server.ts                  # Supabase server client (reads auth cookies)
│   ├── redis.ts                            # Upstash Redis client
│   ├── embeddings.ts                       # OpenAI embedding generation
│   ├── chunking.ts                         # Hierarchical section chunking for long sources
│   ├── scraper.ts                          # Resume / LinkedIn / GitHub text extraction
│   ├── ranking.ts                          # User ranking score calculation
│   ├── streamMarkers.ts                    # Redirect marker encode/decode for streaming
│   └── tools/
│       ├── index.ts                        # Exports advocateTools array + executeTool dispatcher
│       ├── saveExperienceBlock.ts          # Tool: insert block to Supabase + embed
│       ├── updateExperienceBlock.ts        # Tool: patch an existing block
│       ├── upsertSkills.ts                 # Tool: write skills map to user_profiles
│       ├── fetchGithubRepos.ts             # Tool: fetch public repos + READMEs via GitHub API
│       ├── redirectUser.ts                 # Tool: emit redirect marker into stream
│       └── refreshUserHeadline.ts          # Tool: regenerate user headline from blocks
├── prompts/
│   ├── advocate.md                         # System prompt — onboarding agent
│   └── advocate-chat.md                    # System prompt — RAG chat agent (Advocate page)
├── supabase/
│   └── migrations/                         # Ordered SQL migrations (see Database Setup)
├── types/index.ts                          # Shared TypeScript types
├── middleware.ts                           # Auth middleware — protects all app routes
├── .env.local                              # Local secrets (never committed)
├── .env.example                            # Committed env template
└── package.json
```

---

## Getting Started

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd rill-advocate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   # Fill in all required values (see Environment Variables below)
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

---

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API access | [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (server only) | Supabase dashboard |
| `NEXT_PUBLIC_SITE_URL` | Base URL for server-side fetches (e.g. `http://localhost:3000`) | Set manually |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Upstash console |
| `OPENAI_API_KEY` | Embedding generation | [platform.openai.com](https://platform.openai.com) |
| `GITHUB_TOKEN` | GitHub API auth for `fetch_github_repos` tool — optional, raises rate limit from 60 to 5,000 req/hr | [github.com/settings/tokens](https://github.com/settings/tokens) |

---

## Authentication

Rill uses [Supabase Auth](https://supabase.com/docs/guides/auth) for user identity.

| Layer | File | What it does |
|---|---|---|
| Middleware | `middleware.ts` | Runs on every request, refreshes the JWT, redirects unauthenticated users from protected routes |
| Auth page | `app/auth/page.tsx` | Combined sign-in / sign-up form (email + password) |
| Callback | `app/auth/callback/route.ts` | Exchanges the one-time code from email confirmation links for a persistent session |
| Sign-out | `app/auth/signout/route.ts` | `POST` handler that calls `supabase.auth.signOut()` and redirects to `/auth` |

**Protected routes:** `/onboarding`, `/advocate`, `/discover`, `/settings`, `/profile`

**Supabase setup:** In your Supabase project go to **Authentication → URL Configuration** and add `http://localhost:3000/auth/callback` to Redirect URLs (plus your production URL).

---

## API Routes

### Agent & Chat

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/advocate` | Onboarding agent — streaming agentic loop. Reads/writes session in Redis, calls tools mid-stream. |
| `POST` | `/api/advocate/chat` | RAG chat agent — embeds the user's message, retrieves top-5 experience blocks via pgvector, streams Claude's response. Supports both self-mode (candidate asking about themselves) and recruiter mode (asking about another candidate). |

### Search

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/discover/search` | Hybrid recruiter search. Combines pgvector cosine similarity (k=5 blocks per user, NDCG-weighted) with in-memory keyword scoring over block text and skills. Scores are fused via weighted blend (`alpha`), boosted by `ranking_score`, then filtered, sorted, and paginated. |

### Profile & Data

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/profile/[userId]` | Fetch finalized experience blocks, ranking score, skills, and headline for a user. |
| `GET/POST` | `/api/onboarding/session` | Read or write the active onboarding session (draft blocks, conversation history, current step) from Redis. |
| `POST` | `/api/onboarding/finalize` | Flush the completed session from Redis to Supabase. |
| `POST` | `/api/embed` | Generate OpenAI embeddings for one or more experience blocks and store via pgvector. |
| `POST` | `/api/upload/resume` | Resume file upload handler. |

---

## Agent Tools

The onboarding agent at `/api/advocate` runs a streaming agentic loop — text tokens stream to the client in real time, tool calls execute between rounds, and results are fed back before the next streaming turn.

| Tool | File | When called | What it does |
|---|---|---|---|
| `save_experience_block` | `lib/tools/saveExperienceBlock.ts` | Immediately after extracting each experience from a source | Inserts the block into Supabase, generates an OpenAI embedding, updates the user's ranking score |
| `update_experience_block` | `lib/tools/updateExperienceBlock.ts` | After enrichment Q&A adds detail or helper URLs to an existing block | Patches only the changed fields on an existing block in Supabase |
| `upsert_skills` | `lib/tools/upsertSkills.ts` | After processing each source and after enrichment conversations | Writes the inferred skills map (name → score 1–5) to `user_profiles.skills` |
| `fetch_github_repos` | `lib/tools/fetchGithubRepos.ts` | When the user provides a GitHub URL | Calls the GitHub REST API for profile info, public repos, and README excerpts for the top repos |
| `redirect_user` | `lib/tools/redirectUser.ts` | When the user needs to visit an external page (e.g. LinkedIn export) | Emits a `\x00REDIRECT:{...}\x00` marker in the stream; the frontend strips it and renders a link button |
| `refresh_user_headline` | `lib/tools/refreshUserHeadline.ts` | After significant profile updates | Regenerates the user's headline stored in `user_profiles.headline` |

The RAG chat agent at `/api/advocate/chat` has a single `redirect` tool that opens URLs from the retrieved context in a new tab.

### Redirect marker protocol

Tool calls that navigate the user emit a null-byte-delimited JSON marker in the text stream:

```
\x00REDIRECT:{"url":"...","label":"...","reason":"...","open_in_new_tab":true}\x00
```

`lib/streamMarkers.ts` encodes and decodes these markers. The chat window strips them from the displayed message and renders styled link buttons below the conversation.

---

## Database Setup

1. Create a new project in [Supabase](https://supabase.com).
2. Install the Supabase CLI and link your project:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Apply all migrations:
   ```bash
   supabase db push
   ```

### Migrations

| Migration | What it does |
|---|---|
| `20260321000001_enable_pgvector.sql` | Enables the `vector` extension |
| `20260321000002_create_user_profiles.sql` | Creates `user_profiles` table + `updated_at` trigger |
| `20260321000003_create_experience_blocks.sql` | Creates `experience_blocks` table, user index, and HNSW vector index |
| `20260321000004_match_experience_blocks_fn.sql` | Creates `match_experience_blocks()` RPC for global semantic search |
| `20260321000005_rls_policies.sql` | Enables RLS; adds per-user read/write policies |
| `20260324000006_sync_auth_users_to_profiles.sql` | Trigger to auto-create a `user_profiles` row on new Supabase Auth signup |
| `20260324000007_drop_overview_column.sql` | Removes deprecated `overview` column (replaced by `embedded_text`) |
| `20260324000008_add_skills_to_user_profiles.sql` | Adds `skills` JSONB column (name → score 1–5 map) to `user_profiles` |
| `20260324000009_add_converse_fn.sql` | Creates `match_user_experience_blocks()` RPC — user-scoped similarity search for the Advocate chat |
| `20260325000010_add_discover_fields_to_user_profiles.sql` | Adds `headline`, `top_skills`, `helper_url_count`, `github_url`, `linkedin_url` columns for Discover search |
| `20260325000012_auto_sync_profile_aggregates.sql` | Trigger to keep `top_skills` and `helper_url_count` in sync with experience blocks |
| `20260325000013_trigger_display_name_from_metadata.sql` | Trigger to populate `display_name` from Supabase auth user metadata on signup |
| `20260326000014_create_bug_reports.sql` | Creates `bug_reports` table and `bug-screenshots` Storage bucket with per-user RLS |
| `20260326000015_rewrite_similarity_fns.sql` | Rewrites `match_experience_blocks` and `match_user_experience_blocks` to Supabase standard pattern (`match_threshold`, distance-based WHERE, `least(match_count, 200)` cap) |
| `20260326000016_cleanup_seed_v1.sql` | Removes the old hardcoded-UUID sample users inserted by the deleted v1 seed migration |
| `20260326000017_add_profile_visibility.sql` | Adds `is_visible` boolean to `user_profiles` — controls Discover search visibility |
| `20260326000018_add_recruiter_role.sql` | Adds `is_recruiter` boolean and `company_name` to `user_profiles`; updates signup trigger to persist role from auth metadata |

---

## Sample Data (Development Seed)

Five realistic sample candidates are provided for local development and testing. Unlike a SQL migration, the seed script calls OpenAI to generate real 1536-dimension embeddings for every experience block, so all users appear correctly in semantic search on the Discover page.

```bash
bun run seed
```

This script is **idempotent** — running it again deletes and re-creates the sample users. Seed emails use the `@seed.rill.dev` domain so they are easy to distinguish from real accounts.

| Email | Profile | Skills |
|---|---|---|
| alice.chen@seed.rill.dev | Full-stack engineer · ex-Stripe | React, TypeScript, Node.js, PostgreSQL |
| bob.martinez@seed.rill.dev | ML engineer · ex-Hugging Face | Python, PyTorch, LLMs, CUDA |
| carol.kim@seed.rill.dev | Mobile engineer | React Native, Swift, iOS, Expo |
| david.park@seed.rill.dev | Platform engineer | Go, Kubernetes, Terraform |
| emma.larsson@seed.rill.dev | Data/ML engineer | Python, dbt, Spark, SQL |

**Note:** The seed script requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` in `.env.local`. Generating embeddings for all 21 blocks makes approximately 5 batched OpenAI API calls (one per user).

---

## Redis Setup (Upstash)

Onboarding session state (chat history, draft blocks, current step) is stored in [Upstash Redis](https://upstash.com) during the session and written to Supabase on completion.

1. Sign in at [console.upstash.com](https://console.upstash.com) and create a Regional database.
2. Copy the **REST API** endpoint and token into `.env.local` as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Sessions are stored as `session:<userId>` JSON values with a 7-day TTL. No schema setup required — Upstash is schemaless. The `@upstash/redis` client uses the REST API so no local Redis server is needed during development.

---

## Deployment

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com) and connect it to the GitHub repo.
3. Add all environment variables from the table above in the Vercel project settings.
4. Deploy — Vercel handles build, API routes, and streaming responses automatically.

---

## Contributing

- Branch naming: `feature/<short-description>`, `fix/<short-description>`
- Open a PR against `main` with a clear description of the change
- Keep PRs focused — one feature or fix per PR

---

## Roadmap

Features deferred from MVP:

- Interview scoring integration
- Recruiter-side job posting
- Real-time scraping of live profile URLs
- Per-user k=5 guarantee at DB level via window function (currently handled in-memory)
- Multi-user collaboration on profiles
