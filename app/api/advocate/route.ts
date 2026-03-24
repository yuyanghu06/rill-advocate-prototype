import { NextRequest, NextResponse } from "next/server";
import { anthropic, ADVOCATE_SYSTEM_PROMPT } from "@/lib/claude";
import { getSession, setSession } from "@/lib/redis";
import { advocateTools, executeTool } from "@/lib/tools";
import {
  REDIRECT_MARKER_PREFIX,
  REDIRECT_MARKER_SUFFIX,
  TOOL_CALL_MARKER_PREFIX,
  TOOL_CALL_MARKER_SUFFIX,
  NEW_BUBBLE_MARKER,
} from "@/lib/streamMarkers";
import type { OnboardingSession, ChatMessage, MessageContentBlock } from "@/types";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/advocate
 *
 * Runs a streaming agentic loop with tool use:
 *   1. Stream Claude's response to the client token by token.
 *   2. After each streaming round, check for tool_use blocks.
 *   3. Execute any tools, inject redirect markers into the stream for redirect_user.
 *   4. Feed tool results back and start the next streaming round.
 *   5. Continue until stop_reason is "end_turn".
 *   6. Persist the full turn to Redis — including all tool_use and tool_result
 *      messages — so block_ids are available for update_experience_block in
 *      subsequent turns.
 *
 * Body: { userId: string; message: string }
 * Response: text/plain stream — text tokens + optional \x00REDIRECT:{...}\x00 markers
 */

/**
 * Convert an Anthropic MessageParam to a ChatMessage for Redis storage.
 * Messages whose content is entirely text blocks are collapsed to a plain
 * string. Messages containing tool_use or tool_result blocks preserve the
 * full block array so the API can replay them faithfully.
 */
function toStorableMessage(m: Anthropic.MessageParam): ChatMessage {
  const { content } = m;
  if (typeof content === "string") {
    return { role: m.role as "user" | "assistant", content };
  }
  const blocks = content as Anthropic.ContentBlockParam[];
  if (blocks.every((b) => b.type === "text")) {
    return {
      role: m.role as "user" | "assistant",
      content: (blocks as Anthropic.TextBlockParam[]).map((b) => b.text).join(""),
    };
  }
  return {
    role: m.role as "user" | "assistant",
    content: blocks as unknown as MessageContentBlock[],
  };
}

export async function POST(req: NextRequest) {
  const { userId, message } = await req.json();

  if (!userId || !message) {
    return NextResponse.json(
      { error: "userId and message are required" },
      { status: 400 }
    );
  }

  const session: OnboardingSession = (await getSession(userId)) ?? {
    user_id: userId,
    step: "welcome",
    messages: [],
    draft_blocks: [],
    processed_sources: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const encoder = new TextEncoder();
  const priorMessageCount = session.messages.length;

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Reconstruct the full message history for the API.
      // Plain-string messages are passed as-is; block-array messages
      // (tool_use / tool_result) are cast directly — MessageContentBlock is
      // structurally compatible with Anthropic.ContentBlockParam.
      let loopMessages: Anthropic.MessageParam[] = [
        ...session.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content as string | Anthropic.ContentBlockParam[],
        })),
        { role: "user", content: message },
      ];

      let fullAssistantText = "";

      try {
        while (true) {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: ADVOCATE_SYSTEM_PROMPT,
            tools: advocateTools,
            messages: loopMessages,
          });

          // Stream text tokens to the client in real time
          let roundText = "";
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              roundText += chunk.delta.text;
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          fullAssistantText += roundText;

          const finalMsg = await stream.finalMessage();

          // Always push the assistant message so it's captured in loopMessages
          loopMessages.push({ role: "assistant", content: finalMsg.content });

          // No tool calls — this is the final turn
          if (finalMsg.stop_reason !== "tool_use") {
            break;
          }

          // Execute tool calls, inject redirect markers into stream
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of finalMsg.content) {
            if (block.type !== "tool_use") continue;

            // Signal the client which tool is about to run
            controller.enqueue(
              encoder.encode(TOOL_CALL_MARKER_PREFIX + block.name + TOOL_CALL_MARKER_SUFFIX)
            );

            const { result, redirect } = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              userId
            );

            if (redirect) {
              controller.enqueue(
                encoder.encode(REDIRECT_MARKER_PREFIX + JSON.stringify(redirect) + REDIRECT_MARKER_SUFFIX)
              );
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }

          loopMessages.push({ role: "user", content: toolResults });

          // Signal the client to open a fresh bubble for the next response round
          controller.enqueue(encoder.encode(NEW_BUBBLE_MARKER));
        }
      } finally {
        controller.close();
      }

      // Persist the full turn to Redis.
      // Slice from priorMessageCount to capture: the new user message, any
      // interleaved tool_use / tool_result pairs, and the final assistant reply.
      // toStorableMessage collapses text-only messages to plain strings and
      // preserves block arrays for tool messages so block_ids survive between turns.
      const newMessages = loopMessages
        .slice(priorMessageCount)
        .map(toStorableMessage);

      const updatedSession: OnboardingSession = {
        ...session,
        messages: [...session.messages, ...newMessages],
        updated_at: new Date().toISOString(),
      };

      if (/<finalize>/i.test(fullAssistantText)) {
        updatedSession.step = "complete";
      }

      await setSession(updatedSession);
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
