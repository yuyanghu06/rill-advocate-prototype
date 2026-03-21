import { Redis } from "@upstash/redis";
import type { OnboardingSession } from "@/types";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function sessionKey(userId: string): string {
  return `session:${userId}`;
}

export async function getSession(
  userId: string
): Promise<OnboardingSession | null> {
  return redis.get<OnboardingSession>(sessionKey(userId));
}

export async function setSession(session: OnboardingSession): Promise<void> {
  await redis.set(sessionKey(session.user_id), session, {
    ex: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(userId: string): Promise<void> {
  await redis.del(sessionKey(userId));
}
