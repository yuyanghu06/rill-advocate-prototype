#!/usr/bin/env bun
/**
 * scripts/backfill-capability-bullets.ts
 *
 * One-off backfill: regenerates user_profiles.capability_bullets for every
 * user who has at least one experience block. Run once after applying the
 * 20260421000021_add_capability_bullets migration — otherwise users only get
 * bullets after their next block save or skill update.
 *
 * Usage:
 *   bun run scripts/backfill-capability-bullets.ts           # all eligible users
 *   bun run scripts/backfill-capability-bullets.ts --dry     # no writes
 *   bun run scripts/backfill-capability-bullets.ts --limit=10
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { refreshCapabilityBullets } from "@/lib/tools/refreshCapabilityBullets";
import { getServerClient } from "@/lib/supabase";

const DRY_RUN = process.argv.includes("--dry");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : undefined;

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
] as const) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

async function main() {
  const db = getServerClient();

  // Pull the distinct set of user_ids with at least one experience block.
  // Users with zero blocks would no-op inside refreshCapabilityBullets anyway.
  const { data: rows, error } = await db
    .from("experience_blocks")
    .select("user_id")
    .limit(10000);

  if (error) {
    console.error("Failed to fetch user ids:", error.message);
    process.exit(1);
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const targets = LIMIT ? userIds.slice(0, LIMIT) : userIds;

  console.log(
    `Found ${userIds.length} users with blocks; backfilling ${targets.length}${
      DRY_RUN ? " (dry run)" : ""
    }.`
  );

  let ok = 0;
  let failed = 0;

  for (const [i, user_id] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] ${user_id} … `);
    if (DRY_RUN) {
      console.log("skipped (dry run)");
      continue;
    }
    try {
      await refreshCapabilityBullets(user_id);
      ok++;
      console.log("done");
    } catch (e) {
      failed++;
      console.log(`failed: ${(e as Error).message}`);
    }
  }

  console.log(`\nBackfill complete. success=${ok} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
