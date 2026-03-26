---
name: discover 
description: >
  Build the Rill Advocate "Discover" page — a recruiter-facing talent search interface
  that combines keyword filtering with vector-based cosine similarity search against
  the Advocate chunk store. Use this skill any time someone asks to implement or
  extend the Discover page, recruiter search, talent filtering, skill matching,
  semantic search over user profiles, or any query/ranking feature on the Rill
  platform. Also trigger for questions about how to weight keyword vs. semantic
  results, how to surface ranked candidates, or how to integrate the chunk schema
  into search.
---

# Rill Advocate — Discover Page Skill

The Discover page is the primary recruiter-facing interface in Rill Advocate. It lets
recruiters search the full talent pool using a **hybrid retrieval strategy**: exact/fuzzy
keyword matching layered on top of dense vector cosine similarity, scored and ranked
into a unified candidate list.

This skill covers:
1. [Data model assumptions](#1-data-model-assumptions)
2. [Hybrid search architecture](#2-hybrid-search-architecture)
3. [Scoring & ranking](#3-scoring--ranking)
4. [API design](#4-api-design)
5. [Frontend implementation guide](#5-frontend-implementation-guide)
6. [Filter panel spec](#6-filter-panel-spec)
7. [Edge cases & guardrails](#7-edge-cases--guardrails)

---

## 1. Data Model Assumptions

Based on the Advocate chunk schema, each document in the non-relational store has:

```
{
  user_id:        string,        // foreign key to user record
  raw_embedding:  float[],       // dense vector (model-dependent dimension)
  embedded_text:  string,        // the text that was embedded
  source_url:     string,        // origin: LinkedIn post, GitHub repo, PDF page, etc.
  helper_urls:    string[],      // supplementary links: repos, demos, Hackathon showcases
  chunk_tree:     object,        // hierarchical section context (parent → child)
  user_ranking:   number         // platform-assigned credibility score
}
```

Additionally, each **user record** should expose aggregated fields the Discover page
can use directly:

```
{
  user_id:        string,
  display_name:   string,
  avatar_url:     string,
  headline:       string,        // auto-generated 1-line summary from onboarding
  top_skills:     string[],      // extracted keyword tags across all chunks
  total_chunks:   number,
  helper_url_count: number,
  user_ranking:   number
}
```

> **Note:** `top_skills` should be a materialized/denormalized field updated whenever
> the user's chunks change (i.e., on every re-scrape), not computed at query time.

---

## 2. Hybrid Search Architecture

Hybrid search = **keyword pass** + **semantic pass** → **score fusion** → **ranked list**.

### 2a. Keyword Pass

- Tokenize the recruiter's query into individual terms and phrases.
- Run a **full-text search** (e.g., MongoDB `$text`, Elasticsearch `match`, or
  Postgres `tsvector`) against `embedded_text`, `top_skills`, and `headline`.
- Also match against `helper_urls` hostname/path tokens (e.g. "pytorch" in a GitHub
  repo URL is a meaningful signal).
- Return a **BM25 score** (or equivalent TF-IDF score) per matching chunk, then
  aggregate to the user level by **sum** (rewards breadth of matches).

### 2b. Semantic Pass

- Embed the recruiter's raw query using the **same model** used during onboarding
  (critical: embedding space must match).
- Compute **cosine similarity** between the query embedding and every `raw_embedding`
  in the chunk store:

  ```
  cosine_similarity(q, c) = (q · c) / (||q|| * ||c||)
  ```

- For each user, take the **top-K chunk similarities** (default K=5) and aggregate
  with a **weighted average** (decay by rank to reward deep matches, not just a lucky
  single chunk):

  ```
  semantic_score(user) = Σ (sim_k * weight_k)   for k in [1..K]
  weight_k = 1 / log2(k + 1)                    // NDCG-style decay
  ```

- For performance at scale, use **ANN (approximate nearest neighbor)** indexing:
  recommended libraries are `pgvector` (if on Postgres), `Qdrant`, `Weaviate`, or
  `Pinecone`. Do **not** do brute-force cosine on every chunk at query time beyond
  ~100k chunks.

### 2c. Score Fusion (Reciprocal Rank Fusion)

Normalize both scores independently to [0, 1] across the current result window, then
fuse with a configurable weight `α`:

```
final_score = α * norm_semantic + (1 - α) * norm_keyword
```

Default `α = 0.65` (semantic-heavy, since queries like "someone who builds LLM
pipelines" are inherently semantic). Expose `α` as a tunable parameter in the
recruiter UI (see Filter Panel).

> **Why RRF over simple linear combination?** Keyword scores are sparse (many users
> score 0 on keyword), so a pure linear combo collapses to semantic-only for most
> results. Normalizing within the live result window before fusing keeps both signals
> meaningful.

---

## 3. Scoring & Ranking

After fusion, apply **multiplicative boosts** from the user's `user_ranking` field
to avoid pure relevance gaming while still rewarding credibility:

```
boosted_score = final_score * (1 + β * log(1 + user_ranking))
```

Default `β = 0.2` — keeps ranking signal present but prevents a high `user_ranking`
from fully overriding a poor semantic match.

### Sort options to expose in the UI

| Label                  | Sort key                          |
|------------------------|-----------------------------------|
| Best Match (default)   | `boosted_score` DESC              |
| Most Credible          | `user_ranking` DESC               |
| Most Experience        | `total_chunks` DESC               |
| Most Verified          | `helper_url_count` DESC           |

---

## 4. API Design

### Endpoint

```
POST /api/discover/search
```

### Request body

```json
{
  "query":          "string (free text, required)",
  "filters": {
    "skills":       ["string"],       // must-match keyword tags (AND logic)
    "min_ranking":  0,                // floor on user_ranking
    "min_helper_urls": 0,             // floor on helper_url_count
    "has_github":   false,            // at least one helper_url from github.com
    "has_linkedin": false
  },
  "alpha":          0.65,             // semantic weight [0..1]
  "page":           1,
  "page_size":      20,
  "sort":           "best_match"      // "best_match" | "most_credible" | "most_experience" | "most_verified"
}
```

### Response body

```json
{
  "total":   150,
  "page":    1,
  "results": [
    {
      "user_id":         "abc123",
      "display_name":    "Jane Doe",
      "avatar_url":      "https://...",
      "headline":        "Full-stack engineer with ML focus",
      "top_skills":      ["Python", "React", "LLM fine-tuning"],
      "user_ranking":    82,
      "final_score":     0.91,
      "keyword_score":   0.74,
      "semantic_score":  0.96,
      "matching_chunks": [
        {
          "embedded_text": "Built a RAG pipeline using LangChain...",
          "source_url":    "https://github.com/janedoe/rag-demo",
          "helper_urls":   ["https://github.com/janedoe/rag-demo"],
          "similarity":    0.96
        }
      ]
    }
  ]
}
```

Returning `keyword_score`, `semantic_score`, and top `matching_chunks` per user
enables the UI to show **why** a candidate matched, increasing recruiter trust.

---

## 5. Frontend Implementation Guide

### Component tree

```
<DiscoverPage>
  ├── <SearchBar />               // query input + submit
  ├── <FilterPanel />             // collapsible left sidebar (see §6)
  ├── <SortControls />            // dropdown for sort mode + alpha slider
  ├── <ResultsGrid>
  │     └── <CandidateCard />     // one per result
  └── <Pagination />
```

### `<CandidateCard>` must display

- Avatar, display name, headline
- `top_skills` as pill tags (highlight pills that match query keywords)
- `user_ranking` as a visual badge (e.g., star or score bar)
- The **top matching chunk** snippet with its `source_url` labeled
  (e.g., "GitHub", "LinkedIn", "Resume")
- Helper URL icons (GitHub cat, LinkedIn logo, etc.) as quick-links
- `final_score` as a subtle percentage or relevance bar (optional, can be hidden
  behind a "Debug" toggle for non-technical recruiters)

### Search UX behavior

- Debounce query input: fire search on 400ms idle **or** explicit submit.
- On empty query: return top users sorted by `user_ranking` DESC (browse mode).
- Show a **"No results"** state with suggestions to broaden filters, not a blank page.
- Support **query highlighting**: bold the query terms wherever they appear in
  `embedded_text` snippets returned by the API.

---

## 6. Filter Panel Spec

The filter panel sits in a collapsible left sidebar. All filters are additive (AND logic
across filter types, OR within a multi-select).

### Filters to implement

| Filter               | Input type         | Backend field          | Notes                                      |
|----------------------|--------------------|------------------------|--------------------------------------------|
| Skills               | Multi-tag search   | `top_skills`           | Autocomplete from indexed tag vocabulary   |
| Min Credibility      | Slider (0–100)     | `user_ranking`         | Default: 0 (no floor)                     |
| Min Verified Links   | Stepper (0–10+)    | `helper_url_count`     | Proxy for "how much has been verified"     |
| Has GitHub           | Toggle             | `helper_urls` domain   | Filter to users with ≥1 github.com URL     |
| Has LinkedIn         | Toggle             | `helper_urls` domain   | Filter to users with ≥1 linkedin.com URL   |
| Search Mode (alpha)  | Slider (0.0–1.0)   | `alpha` param          | Label ends: "Keyword ←→ Semantic"          |

### Search Mode slider UX guidance

- Left (α=0): pure keyword — good for exact skill names ("Rust", "dbt", "Figma")
- Right (α=1): pure semantic — good for role descriptions ("someone who can lead
  infrastructure migrations")
- Default α=0.65 with a label: **"Balanced (default)"**
- Show a tooltip explaining the tradeoff on hover/focus

---

## 7. Edge Cases & Guardrails

| Scenario                             | Handling                                                                 |
|--------------------------------------|--------------------------------------------------------------------------|
| Query with no keyword matches        | Fall back entirely to semantic score; don't return zero results          |
| Query with no semantic signal        | (very short query, e.g., "ML") Boost keyword weight automatically        |
| User with zero chunks                | Exclude from results entirely; they haven't completed onboarding         |
| Identical `embedded_text` across users | Dedup at chunk level before aggregation to prevent copy-paste gaming   |
| Very new user (low `user_ranking`)   | Still surfaced by relevance; ranking boost is logarithmic, not a gate    |
| Pagination past ANN result window    | Fetch a larger ANN candidate pool (e.g., top 500) and paginate in-memory |
| Empty filters + empty query          | Return top-ranked users by `user_ranking` as a curated default feed      |

---

## Implementation Order (suggested)

1. **Materialize `top_skills`** on the user record — prerequisite for keyword filter.
2. **Stand up the ANN index** on `raw_embedding` (start with `pgvector` if already on
   Postgres; migrate to Qdrant if query latency exceeds 200ms at scale).
3. **Implement the search endpoint** with both passes + RRF fusion.
4. **Build `<CandidateCard>`** with chunk snippet display.
5. **Build `<FilterPanel>`** — skills multi-tag first, then toggles, then alpha slider.
6. **Add sort controls** and pagination.
7. **Instrument** `final_score`, `keyword_score`, `semantic_score` logging for
   relevance tuning over time.