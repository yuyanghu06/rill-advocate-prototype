# Rill Advocate

## Overview

Advocate is an intelligent onboarding agent for the Rill recruiting marketplace. It guides new users through building a rich, structured profile by extracting and organizing their experience from resumes, LinkedIn, GitHub, and other sources. Recruiters can then query the talent pool using natural language, with results ranked by profile completeness and verifiability.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Deployment | Vercel |
| Styling | Tailwind CSS |
| Agent / LLM | Claude API (`claude-sonnet`) |
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
│   ├── page.tsx                        # Landing / entry point
│   ├── onboarding/
│   │   └── page.tsx                    # Onboarding chat UI
│   ├── profile/
│   │   └── [userId]/page.tsx           # User profile view
│   ├── recruiter/
│   │   └── page.tsx                    # Recruiter search UI
│   └── api/
│       ├── advocate/route.ts           # Main agent route handler (streaming)
│       ├── onboarding/
│       │   ├── session/route.ts        # Create/read/update Redis onboarding session
│       │   └── finalize/route.ts       # Flush session to Supabase on completion
│       ├── profile/[userId]/route.ts   # Fetch finalized profile blocks
│       ├── embed/route.ts              # Generate + store embeddings for blocks
│       └── search/route.ts             # Recruiter semantic search via pgvector
├── components/
│   ├── chat/                           # Chat UI components (window, bubbles, uploader)
│   ├── profile/                        # Experience block and ranking badge components
│   └── recruiter/                      # Candidate card component
├── prompts/
│   └── advocate.md                     # System prompt for the Advocate onboarding agent
├── supabase/
│   └── migrations/                     # Ordered SQL migrations (pgvector, tables, RLS, RPC)
├── lib/
│   ├── claude.ts                       # Claude API client + prompt loader
│   ├── supabase.ts                     # Supabase client (server + browser)
│   ├── redis.ts                        # Upstash Redis client
│   ├── embeddings.ts                   # Embedding generation helpers
│   ├── chunking.ts                     # Hierarchical section chunking logic
│   ├── scraper.ts                      # Resume / LinkedIn / GitHub extraction
│   └── ranking.ts                      # User ranking score calculation
├── types/
│   └── index.ts                        # Shared TypeScript types (Block, Session, etc.)
├── public/                             # Static assets
├── .env.local                          # Local secrets (never committed)
├── .env.example                        # Committed env template with blank values
├── requirements.txt                    # Python dependencies for scraping scripts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (server only) | Supabase dashboard |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Upstash console |
| `OPENAI_API_KEY` | Embedding generation | [platform.openai.com](https://platform.openai.com) |

---

## Routes

### Internal API Routes

These are Next.js Route Handlers served by Vercel under `/api/`.

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/advocate` | Main agent endpoint — accepts user messages, streams Claude responses. Reads/writes onboarding session state in Redis. |
| `GET` | `/api/onboarding/session` | Retrieve the current onboarding session (draft blocks, current step) from Redis. |
| `POST` | `/api/onboarding/session` | Create or update the onboarding session in Redis. |
| `POST` | `/api/onboarding/finalize` | Flush the completed session from Redis to Supabase, triggering embedding generation. |
| `GET` | `/api/profile/[userId]` | Fetch all finalized experience blocks for a given user from Supabase. |
| `POST` | `/api/embed` | Generate OpenAI embeddings for one or more experience blocks and store vectors in Supabase via pgvector. |
| `POST` | `/api/search` | Accept a recruiter's natural language query, embed it, run a pgvector similarity search, and return ranked candidate results. |

### Page Routes

| Route | Description |
|---|---|
| `/` | Landing page — entry point for new and returning users. |
| `/onboarding` | Onboarding chat UI — where users interact with the Advocate agent. |
| `/profile/[userId]` | Public-facing profile view showing a user's finalized experience blocks and ranking. |
| `/recruiter` | Recruiter search UI — natural language talent search interface. |

### External APIs Called Server-Side

| Service | Endpoint / SDK | Purpose |
|---|---|---|
| Anthropic (Claude) | `POST api.anthropic.com/v1/messages` | Streaming LLM responses for the onboarding agent and recruiter query mode. |
| OpenAI | `POST api.openai.com/v1/embeddings` | Generate `text-embedding-3-small` vectors for experience blocks and search queries. |
| Supabase | Supabase JS SDK (REST + pgvector RPC) | Read/write experience blocks and user profiles; run vector similarity search. |
| Upstash Redis | Upstash REST API | Store and retrieve in-progress onboarding session state by user ID. |

---

## Database Setup

1. Create a new project in [Supabase](https://supabase.com).
2. Install the Supabase CLI and link your project:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Apply all migrations in order:
   ```bash
   supabase db push
   ```
   Or run them manually in the Supabase SQL editor from `supabase/migrations/`:

   | Migration | What it does |
   |---|---|
   | `20260321000001_enable_pgvector.sql` | Enables the `vector` extension |
   | `20260321000002_create_user_profiles.sql` | Creates `user_profiles` table + `updated_at` trigger |
   | `20260321000003_create_experience_blocks.sql` | Creates `experience_blocks` table, user index, and HNSW vector index |
   | `20260321000004_match_experience_blocks_fn.sql` | Creates `match_experience_blocks()` RPC for semantic search |
   | `20260321000005_rls_policies.sql` | Enables RLS and adds read/update/delete policies per user |

---

## Redis Setup (Upstash)

Advocate uses [Upstash Redis](https://upstash.com) as a serverless session cache. Onboarding state (chat history, draft blocks, current step) lives in Redis during the session and is flushed to Supabase on completion.

### 1. Create a database

1. Sign in at [console.upstash.com](https://console.upstash.com).
2. Click **Create Database**.
3. Choose a name (e.g. `rill-advocate`), select the region closest to your Vercel deployment, and leave the type as **Regional**.
4. Click **Create**.

### 2. Copy credentials

From the database detail page, copy the values under **REST API**:

| Value | Env var |
|---|---|
| Endpoint (the `https://…upstash.io` URL) | `UPSTASH_REDIS_REST_URL` |
| Token | `UPSTASH_REDIS_REST_TOKEN` |

Paste these into `.env.local` (and into Vercel's environment variable settings for production).

### 3. Session schema

Each session is stored as a single JSON value under the key `session:<userId>` and expires automatically after **7 days** of inactivity. No manual schema setup is required — Upstash is schemaless.

The session object shape (defined in `types/index.ts`):

```ts
{
  user_id: string          // Supabase auth UID
  step: "welcome" | "sources" | "enrichment" | "review" | "complete"
  messages: { role, content }[]   // full conversation history sent to Claude
  draft_blocks: ExperienceBlock[] // blocks built up during onboarding
  processed_sources: string[]     // which source types have been handled
  created_at: string
  updated_at: string
}
```

### 4. Session lifecycle

| Event | Redis operation |
|---|---|
| First message from a user | Session created with `SET session:<userId> … EX 604800` |
| Each subsequent message | Session updated in-place (TTL reset on each write) |
| `POST /api/onboarding/finalize` | Blocks written to Supabase, then `DEL session:<userId>` |
| User abandons onboarding | Session expires automatically after 7 days |

### 5. Local development

The `@upstash/redis` client uses the REST API, so there is no local Redis server to run. Your `.env.local` credentials connect directly to the Upstash cloud database during local development. This is intentional — Upstash's free tier (10,000 commands/day) is sufficient for development.

If you need to inspect or clear sessions manually, use the **Data Browser** in the Upstash console, or flush all keys with:

```bash
# Requires upstash-cli or any Redis-compatible client pointed at the REST endpoint
curl -X POST "$UPSTASH_REDIS_REST_URL/flushdb" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

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
- Multi-user collaboration on profiles
