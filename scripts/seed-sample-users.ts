#!/usr/bin/env bun
/**
 * scripts/seed-sample-users.ts
 *
 * Seeds the database with five realistic sample candidates.
 * Each experience block gets a real OpenAI embedding stored in raw_embedding,
 * so all users surface in semantic search on the Discover page.
 *
 * Usage:
 *   bun run seed
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *
 * Idempotent: any existing user with a seed email is deleted before re-creation.
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// ── Environment ───────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error(
    "Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are set in .env.local"
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

type SeedBlock = {
  title: string;
  embedded_text: string;
  source_type: "resume" | "linkedin" | "github" | "other";
  source_url: string;
  helper_urls: string[];
  date_range: string;
};

type SeedUser = {
  email: string;
  full_name: string;
  display_name: string;
  headline: string;
  skills: Record<string, number>;
  top_skills: string[];
  blocks: SeedBlock[];
};

// ── Sample data ───────────────────────────────────────────────────────────────

const SEED_USERS: SeedUser[] = [
  {
    email: "alice.chen@seed.rill.dev",
    full_name: "Alice Chen",
    display_name: "Alice Chen",
    headline: "Full-stack engineer · React, TypeScript, Node.js · ex-Stripe",
    skills: { React: 5, TypeScript: 5, "Node.js": 4, PostgreSQL: 4, AWS: 3, GraphQL: 4 },
    top_skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "GraphQL"],
    blocks: [
      {
        title: "Senior Software Engineer — Stripe",
        embedded_text:
          "Led development of the Stripe Dashboard reporting module — a React and GraphQL interface used by over 500k merchants daily. Owned the full stack from API design in Node.js to PostgreSQL query optimisation, reducing p99 load times by 40%. Mentored two junior engineers and drove the adoption of TypeScript across the team.",
        source_type: "resume",
        source_url: "",
        helper_urls: ["https://stripe.com/blog/new-dashboard"],
        date_range: "2021–2024",
      },
      {
        title: "Open Source — react-query-devtools contributor",
        embedded_text:
          "Contributed performance improvements and a new timeline visualiser to react-query-devtools. The PR was merged into the main TanStack Query repo with the specific feature receiving 200+ GitHub stars. Wrote the accompanying documentation and migration guide.",
        source_type: "github",
        source_url: "https://github.com/TanStack/query",
        helper_urls: [
          "https://github.com/TanStack/query/pull/5821",
          "https://tanstack.com/query/latest",
        ],
        date_range: "2023",
      },
      {
        title: "Side Project — Budgetly (personal finance SaaS)",
        embedded_text:
          "Built and shipped a solo SaaS product for personal budgeting with Plaid integration, AWS Lambda background jobs, and a Next.js frontend. Grew to 800 monthly active users organically with no paid acquisition. Handles roughly $2M in tracked transactions per month.",
        source_type: "other",
        source_url: "",
        helper_urls: ["https://github.com/alicechen/budgetly", "https://budgetly.app"],
        date_range: "2022–present",
      },
      {
        title: "Software Engineer Intern — Cloudflare",
        embedded_text:
          "Worked on the Cloudflare Workers runtime, implementing a new API for scheduled cron triggers. Wrote Rust extensions to the V8 isolate runtime and shipped the feature to production serving billions of requests per day.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "Summer 2020",
      },
    ],
  },
  {
    email: "bob.martinez@seed.rill.dev",
    full_name: "Bob Martinez",
    display_name: "Bob Martinez",
    headline: "ML engineer · PyTorch, LLM fine-tuning, CUDA · ex-Hugging Face",
    skills: { Python: 5, PyTorch: 5, LLMs: 5, CUDA: 4, Transformers: 5, MLflow: 3 },
    top_skills: ["Python", "PyTorch", "LLMs", "CUDA", "Transformers", "MLflow"],
    blocks: [
      {
        title: "ML Research Engineer — Hugging Face",
        embedded_text:
          "Designed and trained instruction-tuned variants of Mistral-7B for code generation tasks, achieving a 12-point improvement on HumanEval over the base model. Published the model weights to the Hugging Face Hub where they have been downloaded over 50k times. Led a team of three researchers across two time zones.",
        source_type: "resume",
        source_url: "",
        helper_urls: [
          "https://huggingface.co/bobm/mistral-code-v1",
          "https://arxiv.org/abs/2309.99999",
        ],
        date_range: "2022–2024",
      },
      {
        title: "Research — Efficient CUDA Kernels for Attention",
        embedded_text:
          "Implemented and benchmarked custom CUDA kernels for multi-head attention, achieving 2.3× throughput over vanilla PyTorch on A100 GPUs. Open-sourced the work with a detailed blog post. The repo has 1.2k stars and has been cited in three subsequent papers.",
        source_type: "github",
        source_url: "https://github.com/bobmartinez/fast-attn",
        helper_urls: [
          "https://github.com/bobmartinez/fast-attn",
          "https://bobmartinez.dev/blog/fast-attn",
        ],
        date_range: "2023",
      },
      {
        title: "Side Project — LLM Eval Harness (open source)",
        embedded_text:
          "Built a lightweight evaluation harness for benchmarking LLMs on custom datasets with support for OpenAI, Anthropic, and local models via Ollama. Tracks accuracy, latency, and cost per token across runs. Used internally at two YC-backed startups for model selection.",
        source_type: "github",
        source_url: "https://github.com/bobmartinez/llm-eval",
        helper_urls: ["https://github.com/bobmartinez/llm-eval"],
        date_range: "2024–present",
      },
      {
        title: "ML Engineer Intern — OpenAI (pre-GPT-4)",
        embedded_text:
          "Contributed to fine-tuning infrastructure improvements for RLHF pipelines. Wrote data preprocessing tooling in Python used by the alignment team, reducing preprocessing time from 6 hours to 40 minutes on standard training datasets.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "Summer 2021",
      },
      {
        title: "Talk — Practical LLM Fine-Tuning at MLConf 2024",
        embedded_text:
          "Delivered a 45-minute technical talk on fine-tuning LLMs for production, covering LoRA, QLoRA, and DPO with real-world case studies from two shipping products. Rated 4.8/5 by 300+ attendees. Slides and recording publicly available.",
        source_type: "other",
        source_url: "https://mlconf.com/2024/speakers/bob-martinez",
        helper_urls: [
          "https://mlconf.com/2024/speakers/bob-martinez",
          "https://slides.bobmartinez.dev/mlconf-2024",
        ],
        date_range: "2024",
      },
    ],
  },
  {
    email: "carol.kim@seed.rill.dev",
    full_name: "Carol Kim",
    display_name: "Carol Kim",
    headline: "Mobile engineer · React Native, Swift, iOS · 3 App Store launches",
    skills: { "React Native": 5, Swift: 4, iOS: 5, Expo: 4, Firebase: 3, Figma: 3 },
    top_skills: ["React Native", "Swift", "iOS", "Expo", "Firebase", "Figma"],
    blocks: [
      {
        title: "iOS Engineer — Duolingo",
        embedded_text:
          "Built and maintained the iOS streaks and gamification systems used by 20M+ daily active users. Rewrote the streak animation engine in Swift with a custom CALayer compositor, cutting frame drops by 70%. Collaborated closely with designers using Figma prototypes for rapid iteration.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2022–2024",
      },
      {
        title: "App — Habitly (habit tracking, App Store)",
        embedded_text:
          "Designed and shipped a habit-tracking app for iOS using React Native and Expo. Reached #12 in the Health & Fitness category on launch day. Features offline-first sync via Firebase Firestore and a custom Apple Watch complication built in Swift. Maintains a 4.7-star rating across 800 reviews.",
        source_type: "other",
        source_url: "",
        helper_urls: [
          "https://apps.apple.com/app/habitly/id1234567890",
          "https://github.com/carolkim/habitly",
        ],
        date_range: "2023–present",
      },
      {
        title: "App — Splitr (expense splitting, App Store)",
        embedded_text:
          "Built a real-time expense-splitting app with React Native, Firebase Realtime Database, and Stripe Connect for peer-to-peer payouts. Supports multi-currency splitting across 30+ currencies. Featured by Apple in the App Store's New Apps We Love section at launch.",
        source_type: "other",
        source_url: "",
        helper_urls: ["https://apps.apple.com/app/splitr/id9876543210"],
        date_range: "2021–2022",
      },
      {
        title: "Contract — React Native consultancy",
        embedded_text:
          "Delivered four React Native projects for early-stage startups including a telemedicine app and a B2B logistics tracker. Acted as the sole mobile engineer on each engagement, handling architecture, CI/CD with Fastlane, and App Store submission through review.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2020–2021",
      },
    ],
  },
  {
    email: "david.park@seed.rill.dev",
    full_name: "David Park",
    display_name: "David Park",
    headline: "Backend / platform engineer · Go, Kubernetes, distributed systems",
    skills: { Go: 5, Kubernetes: 5, "Distributed Systems": 4, Terraform: 4, PostgreSQL: 3, Rust: 3 },
    top_skills: ["Go", "Kubernetes", "Distributed Systems", "Terraform", "PostgreSQL", "Rust"],
    blocks: [
      {
        title: "Senior Platform Engineer — Notion",
        embedded_text:
          "Owned the infrastructure migration from a monolithic Node.js backend to a set of Go microservices orchestrated on Kubernetes. Cut cold-start latency by 60% and reduced monthly cloud spend by $180k through right-sizing and spot instance adoption. Wrote Terraform modules now used across six product teams.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2022–2024",
      },
      {
        title: "Open Source — k8s-autoscaler-policy (Go)",
        embedded_text:
          "Authored a Kubernetes admission webhook in Go that enforces autoscaling policies across namespaces, preventing misconfigured HPA deployments from starving other workloads. Ships with a Helm chart and has been adopted by three mid-size engineering teams.",
        source_type: "github",
        source_url: "https://github.com/davidpark/k8s-autoscaler-policy",
        helper_urls: [
          "https://github.com/davidpark/k8s-autoscaler-policy",
          "https://davidpark.dev/posts/k8s-admission-webhook",
        ],
        date_range: "2023",
      },
      {
        title: "Backend Engineer — Segment (now Twilio)",
        embedded_text:
          "Built and maintained the event pipeline that ingests 500B+ events per month. Designed a backpressure-aware consumer in Go that eliminated pipeline lag spikes during traffic bursts. On-call rotation for a tier-1 service with a 99.99% SLA.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2019–2022",
      },
      {
        title: "Side Project — pg-live-query (Rust + PostgreSQL)",
        embedded_text:
          "Implemented a Rust library that uses PostgreSQL logical replication to deliver live query results over WebSockets, similar to Supabase Realtime but embeddable in any Postgres-backed app. Early-access users include two fintech startups.",
        source_type: "github",
        source_url: "https://github.com/davidpark/pg-live-query",
        helper_urls: ["https://github.com/davidpark/pg-live-query"],
        date_range: "2024–present",
      },
    ],
  },
  {
    email: "emma.larsson@seed.rill.dev",
    full_name: "Emma Larsson",
    display_name: "Emma Larsson",
    headline: "Data / ML engineer · Python, dbt, Spark · analytics infrastructure",
    skills: { Python: 5, dbt: 5, Spark: 4, SQL: 5, Airflow: 4, "scikit-learn": 3 },
    top_skills: ["Python", "dbt", "Spark", "SQL", "Airflow", "scikit-learn"],
    blocks: [
      {
        title: "Senior Data Engineer — Shopify",
        embedded_text:
          "Designed the merchant analytics data platform serving 1M+ merchants. Migrated 200+ Airflow DAGs to a modular dbt + Spark architecture, reducing pipeline runtime from 14 hours to 3 hours. Introduced data contracts and automated schema drift detection used by 40 analysts.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2021–2024",
      },
      {
        title: "Open Source — dbt-impact (dbt meta-analysis tool)",
        embedded_text:
          "Published a dbt plugin that maps downstream BI dashboard dependencies for every model, enabling safe refactors by showing blast radius before a schema change is deployed. Over 800 dbt Cloud users have installed it from the Hub.",
        source_type: "github",
        source_url: "https://github.com/emmalarsson/dbt-impact",
        helper_urls: [
          "https://github.com/emmalarsson/dbt-impact",
          "https://hub.getdbt.com/emmalarsson/dbt-impact",
        ],
        date_range: "2023",
      },
      {
        title: "ML Engineer — Klarna (credit risk)",
        embedded_text:
          "Built a gradient-boosted credit risk scoring model in Python with scikit-learn and XGBoost, replacing a rules-based system. Reduced false decline rate by 18% while keeping default rate flat. Deployed as a low-latency REST service with sub-10ms p99 via FastAPI and Redis caching.",
        source_type: "resume",
        source_url: "",
        helper_urls: [],
        date_range: "2019–2021",
      },
      {
        title: "Talk — Real-Time Feature Pipelines with Spark Structured Streaming",
        embedded_text:
          "Presented at Data Engineering Summit 2023 on building real-time feature pipelines that feed ML models using Spark Structured Streaming and Delta Lake. Covered exactly-once guarantees, schema evolution, and cost trade-offs versus batch pipelines.",
        source_type: "other",
        source_url: "https://datasummit.io/2023/emma-larsson",
        helper_urls: [
          "https://datasummit.io/2023/emma-larsson",
          "https://emmalarsson.dev/talks/spark-streaming-2023",
        ],
        date_range: "2023",
      },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding sample users...\n");

  for (const seedUser of SEED_USERS) {
    console.log(`→ ${seedUser.display_name} (${seedUser.email})`);

    // 1. Delete existing user with this email (idempotent)
    const { data: { users } } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find((u) => u.email === seedUser.email);
    if (existing) {
      await db.auth.admin.deleteUser(existing.id);
      await sleep(400); // wait for FK cascades
      console.log(`  cleaned up existing user ${existing.id}`);
    }

    // 2. Create auth user — triggers on_auth_user_created → inserts user_profiles row
    const { data: { user: authUser }, error: createError } =
      await db.auth.admin.createUser({
        email: seedUser.email,
        password: "SeedPass#2026!",
        email_confirm: true,
        user_metadata: { full_name: seedUser.full_name },
      });
    if (createError || !authUser) {
      console.error(`  ✗ failed to create auth user: ${createError?.message}`);
      continue;
    }
    console.log(`  created auth user ${authUser.id}`);

    await sleep(500); // allow on_auth_user_created trigger to commit

    // 3. Enrich user_profiles
    const { error: profileError } = await db
      .from("user_profiles")
      .update({
        display_name: seedUser.display_name,
        headline: seedUser.headline,
        skills: seedUser.skills,
        top_skills: seedUser.top_skills,
      })
      .eq("user_id", authUser.id);
    if (profileError) {
      console.error(`  ✗ profile update failed: ${profileError.message}`);
    }

    // 4. Batch-embed all block texts in a single OpenAI call
    const texts = seedUser.blocks.map((b) => b.embedded_text);
    const embeddings = await embedBatch(texts);

    // 5. Insert experience blocks with embeddings
    const blocks = seedUser.blocks.map((b, i) => ({
      block_id: crypto.randomUUID(),
      user_id: authUser.id,
      title: b.title,
      embedded_text: b.embedded_text,
      raw_embedding: `[${embeddings[i].join(",")}]`,
      source_type: b.source_type,
      source_url: b.source_url,
      helper_urls: b.helper_urls,
      date_range: b.date_range,
    }));

    const { error: blockError } = await db.from("experience_blocks").insert(blocks);
    if (blockError) {
      console.error(`  ✗ block insert failed: ${blockError.message}`);
      continue;
    }

    console.log(`  ✓ inserted ${blocks.length} blocks with embeddings\n`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
