import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import type { ChatMessage } from "@/types";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function loadPrompt(name: string): string {
  return readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf-8");
}

export const ADVOCATE_SYSTEM_PROMPT = loadPrompt("advocate");

export function buildMessages(
  history: ChatMessage[],
  userMessage: string
): Anthropic.MessageParam[] {
  const params: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  params.push({ role: "user", content: userMessage });
  return params;
}

export function streamAdvocateResponse(
  history: ChatMessage[],
  userMessage: string
): ReadableStream<Uint8Array> {
  const messages = buildMessages(history, userMessage);

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: ADVOCATE_SYSTEM_PROMPT,
    messages,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });
}

export async function getFullAdvocateResponse(
  history: ChatMessage[],
  userMessage: string
): Promise<string> {
  const messages = buildMessages(history, userMessage);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: ADVOCATE_SYSTEM_PROMPT,
    messages,
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}
