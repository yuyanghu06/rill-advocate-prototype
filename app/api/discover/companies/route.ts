import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

/**
 * GET /api/discover/companies
 *
 * Returns recruiter/company profiles for the candidate-facing Discover feed.
 * Only returns profiles where is_recruiter = true AND is_visible = true.
 * Each profile includes their job opening blocks.
 */
export async function GET() {
  const db = getServerClient();

  const { data: recruiters, error } = await db
    .from("user_profiles")
    .select("user_id, display_name, company_name, headline, top_skills, skills, ranking_score")
    .eq("is_recruiter", true)
    .eq("is_visible", true)
    .order("ranking_score", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recruiters?.length) return NextResponse.json({ results: [] });

  const recruiterIds = recruiters.map((r: { user_id: string }) => r.user_id);

  const { data: blocks } = await db
    .from("experience_blocks")
    .select("block_id, user_id, title, embedded_text, helper_urls, date_range")
    .in("user_id", recruiterIds)
    .order("created_at", { ascending: false });

  const blocksByUser = new Map<string, typeof blocks>();
  for (const block of blocks ?? []) {
    const list = blocksByUser.get(block.user_id) ?? [];
    list.push(block);
    blocksByUser.set(block.user_id, list);
  }

  const results = recruiters.map((r: {
    user_id: string;
    display_name: string | null;
    company_name: string | null;
    headline: string | null;
    top_skills: string[];
    skills: Record<string, number> | null;
    ranking_score: number;
  }) => ({
    user_id:       r.user_id,
    display_name:  r.display_name,
    company_name:  r.company_name,
    headline:      r.headline,
    top_skills:    r.top_skills ?? [],
    skills:        r.skills ?? {},
    ranking_score: r.ranking_score,
    job_openings:  blocksByUser.get(r.user_id) ?? [],
  }));

  return NextResponse.json({ results });
}
