-- Seed migration: three realistic sample users for development/testing.
--
-- Auth users are inserted first so the on_auth_user_created trigger fires
-- and creates the corresponding user_profiles rows automatically.
-- Profiles are then enriched with display names, headlines, skills, and
-- experience blocks.
--
-- raw_embedding is intentionally left NULL; these users will appear in
-- browse mode (empty query) but will not surface in semantic search results
-- until real embeddings are generated via /api/embed.

-- ─── 1. Auth users ────────────────────────────────────────────────────────────

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  created_at,
  updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'alice.chen@example.com',
    '$2a$10$placeholder_hash_alice_not_real',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Alice Chen"}',
    false, 'authenticated', 'authenticated',
    now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bob.martinez@example.com',
    '$2a$10$placeholder_hash_bob_not_real',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Bob Martinez"}',
    false, 'authenticated', 'authenticated',
    now(), now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'carol.kim@example.com',
    '$2a$10$placeholder_hash_carol_not_real',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carol Kim"}',
    false, 'authenticated', 'authenticated',
    now(), now()
  )
on conflict (id) do nothing;

-- ─── 2. Enrich profiles ───────────────────────────────────────────────────────

update user_profiles set
  display_name      = 'Alice Chen',
  headline          = 'Full-stack engineer · React, Node.js, PostgreSQL · ex-Stripe',
  top_skills        = array['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'GraphQL'],
  ranking_score     = 38,
  helper_url_count  = 4,
  skills            = '{"React":5,"TypeScript":5,"Node.js":4,"PostgreSQL":4,"AWS":3,"GraphQL":4}'::jsonb
where user_id = '11111111-1111-1111-1111-111111111111';

update user_profiles set
  display_name      = 'Bob Martinez',
  headline          = 'ML engineer · PyTorch, LLM fine-tuning · ex-Hugging Face',
  top_skills        = array['Python', 'PyTorch', 'LLMs', 'CUDA', 'Transformers', 'MLflow'],
  ranking_score     = 45,
  helper_url_count  = 6,
  skills            = '{"Python":5,"PyTorch":5,"LLMs":5,"CUDA":4,"Transformers":5,"MLflow":3}'::jsonb
where user_id = '22222222-2222-2222-2222-222222222222';

update user_profiles set
  display_name      = 'Carol Kim',
  headline          = 'Mobile developer · React Native, Swift · 3 App Store launches',
  top_skills        = array['React Native', 'Swift', 'iOS', 'Expo', 'Firebase', 'Figma'],
  ranking_score     = 29,
  helper_url_count  = 3,
  skills            = '{"React Native":5,"Swift":4,"iOS":5,"Expo":4,"Firebase":3,"Figma":3}'::jsonb
where user_id = '33333333-3333-3333-3333-333333333333';

-- ─── 3. Experience blocks ─────────────────────────────────────────────────────

insert into experience_blocks (
  block_id, user_id, title, embedded_text,
  source_type, source_url, helper_urls, date_range
) values

-- Alice Chen
(
  'a1111111-0001-0001-0001-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Senior Software Engineer — Stripe',
  'Led development of the Stripe Dashboard''s reporting module, a React + GraphQL interface used by over 500k merchants daily. Owned the full stack from API design in Node.js to PostgreSQL query optimisation, reducing p99 load times by 40%. Mentored two junior engineers and drove the adoption of TypeScript across the team.',
  'resume', '',
  array['https://stripe.com/blog/new-dashboard'],
  '2021–2024'
),
(
  'a1111111-0002-0002-0002-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Open Source — react-query-devtools contributor',
  'Contributed performance improvements and a new timeline visualiser to react-query-devtools. PR merged into the main repo with 200+ GitHub stars on the specific feature. Wrote the accompanying documentation and migration guide.',
  'github', 'https://github.com/TanStack/query',
  array['https://github.com/TanStack/query/pull/5821', 'https://tanstack.com/query/latest'],
  '2023'
),
(
  'a1111111-0003-0003-0003-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'Side Project — Budgetly (personal finance SaaS)',
  'Built and shipped a solo SaaS product for personal budgeting with Plaid integration, AWS Lambda background jobs, and a Next.js frontend. Grew to 800 monthly active users organically. Handles ~$2M in tracked transactions per month.',
  'other', '',
  array['https://github.com/alicechen/budgetly', 'https://budgetly.app'],
  '2022–present'
),
(
  'a1111111-0004-0004-0004-000000000004',
  '11111111-1111-1111-1111-111111111111',
  'Software Engineer Intern — Cloudflare',
  'Worked on Cloudflare Workers runtime, implementing a new API for scheduled cron triggers. Wrote Rust extensions to the V8 isolate runtime and shipped the feature to production serving billions of requests per day.',
  'resume', '',
  array[]::text[],
  'Summer 2020'
),

-- Bob Martinez
(
  'b2222222-0001-0001-0001-000000000001',
  '22222222-2222-2222-2222-222222222222',
  'ML Research Engineer — Hugging Face',
  'Designed and trained instruction-tuned variants of Mistral-7B for code generation tasks, achieving a 12-point improvement on HumanEval over the base model. Published the model weights to the Hugging Face Hub where they have been downloaded over 50k times. Led a team of three researchers across two time zones.',
  'resume', '',
  array['https://huggingface.co/bobm/mistral-code-v1', 'https://arxiv.org/abs/2309.99999'],
  '2022–2024'
),
(
  'b2222222-0002-0002-0002-000000000002',
  '22222222-2222-2222-2222-222222222222',
  'Research — Efficient CUDA Kernels for Attention',
  'Implemented and benchmarked custom CUDA kernels for multi-head attention, achieving 2.3× throughput over vanilla PyTorch on A100 GPUs. Open-sourced the work with a detailed blog post. The repo has 1.2k stars and has been cited in three subsequent papers.',
  'github', 'https://github.com/bobmartinez/fast-attn',
  array['https://github.com/bobmartinez/fast-attn', 'https://bobmartinez.dev/blog/fast-attn'],
  '2023'
),
(
  'b2222222-0003-0003-0003-000000000003',
  '22222222-2222-2222-2222-222222222222',
  'Side Project — LLM Eval Harness (open source)',
  'Built a lightweight evaluation harness for benchmarking LLMs on custom datasets with support for OpenAI, Anthropic, and local models. Tracks accuracy, latency, and cost per token. Used internally at two YC-backed startups.',
  'github', 'https://github.com/bobmartinez/llm-eval',
  array['https://github.com/bobmartinez/llm-eval'],
  '2024–present'
),
(
  'b2222222-0004-0004-0004-000000000004',
  '22222222-2222-2222-2222-222222222222',
  'ML Engineer Intern — OpenAI (pre-GPT-4)',
  'Contributed to fine-tuning infrastructure improvements for RLHF pipelines. Wrote data preprocessing tooling in Python used by the alignment team, reducing preprocessing time from 6 hours to 40 minutes on standard datasets.',
  'resume', '',
  array[]::text[],
  'Summer 2021'
),
(
  'b2222222-0005-0005-0005-000000000005',
  '22222222-2222-2222-2222-222222222222',
  'Talk — "Practical LLM Fine-Tuning" at MLConf 2024',
  'Delivered a 45-minute talk on practical approaches to fine-tuning LLMs for production use cases, covering LoRA, QLoRA, and DPO with real-world case studies. Rated 4.8/5 by 300+ attendees.',
  'other', 'https://mlconf.com/2024/speakers/bob-martinez',
  array['https://mlconf.com/2024/speakers/bob-martinez', 'https://slides.bobmartinez.dev/mlconf-2024'],
  '2024'
),

-- Carol Kim
(
  'c3333333-0001-0001-0001-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'iOS Engineer — Duolingo',
  'Built and maintained the iOS streaks and gamification systems used by 20M+ daily active users. Rewrote the streak animation engine in Swift with a custom CALayer compositor, cutting frame drops by 70%. Collaborated closely with designers using Figma prototypes.',
  'resume', '',
  array[]::text[],
  '2022–2024'
),
(
  'c3333333-0002-0002-0002-000000000002',
  '33333333-3333-3333-3333-333333333333',
  'App — Habitly (habit tracking, App Store)',
  'Designed and shipped a habit-tracking app for iOS using React Native and Expo. Reached #12 in the Health & Fitness category on launch day. Features offline-first sync via Firebase and a custom Apple Watch complication. 4.7-star rating across 800 reviews.',
  'other', '',
  array['https://apps.apple.com/app/habitly/id1234567890', 'https://github.com/carolkim/habitly'],
  '2023–present'
),
(
  'c3333333-0003-0003-0003-000000000003',
  '33333333-3333-3333-3333-333333333333',
  'App — Splitr (expense splitting, App Store)',
  'Built a real-time expense-splitting app with React Native, Firebase Realtime Database, and Stripe Connect for payouts. Handles multi-currency splitting across 30+ currencies. Featured in the App Store''s "New Apps We Love" section.',
  'other', '',
  array['https://apps.apple.com/app/splitr/id9876543210'],
  '2021–2022'
),
(
  'c3333333-0004-0004-0004-000000000004',
  '33333333-3333-3333-3333-333333333333',
  'Contract — React Native consultancy (various clients)',
  'Delivered four React Native projects for early-stage startups including a telemedicine app and a B2B logistics tracker. Sole mobile engineer on each engagement; handled architecture, CI/CD with Fastlane, and App Store submission.',
  'resume', '',
  array[]::text[],
  '2020–2021'
)
on conflict (block_id) do nothing;
