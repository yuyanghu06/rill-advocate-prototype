import { NextRequest, NextResponse } from "next/server";
import { streamAdvocateResponse } from "@/lib/claude";
import { getSession, setSession } from "@/lib/redis";
import type { OnboardingSession, ChatMessage, ExperienceBlock } from "@/types";

/**
 * POST /api/advocate
 *
 * Accepts a user message, appends it to the session history,
 * streams Claude's response back, and persists the updated session to Redis.
 *
 * Body: { userId: string; message: string }
 * Response: text/plain stream of assistant tokens
 */
export async function POST(req: NextRequest) {
  const { userId, message } = await req.json();

  if (!userId || !message) {
    return NextResponse.json(
      { error: "userId and message are required" },
      { status: 400 }
    );
  }

  // Load or create session
  let session: OnboardingSession = (await getSession(userId)) ?? {
    user_id: userId,
    step: "welcome",
    messages: [],
    draft_blocks: [],
    processed_sources: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const userMsg: ChatMessage = { role: "user", content: message };
  const historyBeforeMessage = [...session.messages];

  // Stream Claude's response while collecting the full text
  const responseStream = streamAdvocateResponse(historyBeforeMessage, message);

  // We need the full text to check for <finalize> and persist the message.
  // We tee the stream: one branch goes to the client, the other is consumed here.
  const [clientStream, collectorStream] = responseStream.tee();

  // Collect full response in the background to update session
  (async () => {
    const decoder = new TextDecoder();
    let fullText = "";
    const reader = collectorStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }

    const assistantMsg: ChatMessage = { role: "assistant", content: fullText };
    session = {
      ...session,
      messages: [...session.messages, userMsg, assistantMsg],
      updated_at: new Date().toISOString(),
    };

    // Check if Claude signalled profile finalisation
    const finalizeMatch = fullText.match(/<finalize>([\s\S]*?)<\/finalize>/);
    if (finalizeMatch) {
      try {
        const blocks: Omit<ExperienceBlock, "raw_embedding">[] = JSON.parse(
          finalizeMatch[1].trim()
        );
        session = {
          ...session,
          draft_blocks: blocks.map((b) => ({ ...b, user_id: userId, block_id: crypto.randomUUID() })),
          step: "complete",
        };
      } catch {
        // Malformed JSON from model — leave step as-is
      }
    }

    await setSession(session);
  })();

  return new Response(clientStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
