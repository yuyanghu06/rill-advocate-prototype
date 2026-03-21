import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/redis";
import type { OnboardingSession } from "@/types";

/**
 * GET /api/onboarding/session?userId=<id>
 * Returns the current onboarding session from Redis, or null if none exists.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const session = await getSession(userId);
  return NextResponse.json({ session });
}

/**
 * POST /api/onboarding/session
 * Creates a new session or merges a partial update into an existing one.
 *
 * Body: { userId: string } & Partial<OnboardingSession>
 */
export async function POST(req: NextRequest) {
  const body: { userId: string } & Partial<OnboardingSession> = await req.json();
  const { userId, ...updates } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const existing: OnboardingSession = (await getSession(userId)) ?? {
    user_id: userId,
    step: "welcome",
    messages: [],
    draft_blocks: [],
    processed_sources: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const updated: OnboardingSession = {
    ...existing,
    ...updates,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  await setSession(updated);
  return NextResponse.json({ session: updated });
}
