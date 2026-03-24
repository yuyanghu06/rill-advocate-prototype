import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";
import { embedText } from "@/lib/embeddings";
import { readFileSync } from "fs";
import { join } from "path";
import {
  REDIRECT_MARKER_PREFIX,
  REDIRECT_MARKER_SUFFIX,
} from "@/lib/streamMarkers";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/converse
 *
 * RAG chat about the authenticated user's own profile.
 * 1. Embed the user's message.
 * 2. Query experience_blocks (top 5 by cosine similarity) + fetch skills.
 * 3. Build the context block and inject into prompts/converse.md.
 * 4. Stream Claude's response; execute the redirect tool client-side via markers.
 *
 * Body: { message: string; history: { role: "user" | "assistant"; content: string }[] }
 */

const CONVERSE_PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), "prompts", "converse.md"),
  "utf-8"
);

const converseRedirectTool: Anthropic.Tool = {
  name: "redirect",
  description:
    "Opens a URL for the user in a new tab. Use this when a helper URL or source URL from the retrieved context would help the user explore a topic further — e.g., a GitHub repo, deployed demo, or project page. Only use URLs that appear in the retrieved context.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "The fully-qualified URL to open. Must be present in the retrieved context.",
      },
      reason: {
        type: "string",
        description: "One-sentence explanation shown to the user before the tab opens.",
      },
    },
    required: ["url", "reason"],
  },
};

type HistoryMessage = { role: "user" | "assistant"; content: string };

interface ExperienceRow {
  block_id: string;
  title: string;
  source_url: string | null;
  helper_urls: string[] | null;
  embedded_text: string | null;
  similarity: number;
}

function buildContext(blocks: ExperienceRow[], skills: Record<string, number>): string {
  const lines: string[] = ["--- RETRIEVED CONTEXT ---", ""];

  if (blocks.length > 0) {
    lines.push("### Relevant Experiences");
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.title}`);
      if (b.embedded_text) lines.push(`   ${b.embedded_text}`);
      if (b.source_url) lines.push(`   Source: ${b.source_url}`);
      if (b.helper_urls?.length) lines.push(`   Links: ${b.helper_urls.join(", ")}`);
    });
    lines.push("");
  }

  if (Object.keys(skills).length > 0) {
    lines.push("### Skills");
    Object.entries(skills)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, score]) => lines.push(`- ${name} (${score}/5)`));
    lines.push("");
  }

  // Collect all URLs for the model to reference
  const allUrls = new Set<string>();
  blocks.forEach((b) => {
    if (b.source_url) allUrls.add(b.source_url);
    b.helper_urls?.forEach((u) => allUrls.add(u));
  });
  if (allUrls.size > 0) {
    lines.push("### Available URLs for redirect tool");
    allUrls.forEach((u) => lines.push(u));
    lines.push("");
  }

  lines.push("-------------------------");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, history = [] } = await req.json() as {
    message: string;
    history: HistoryMessage[];
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Embed the user's message + query experience blocks in parallel with skills fetch
  const db = getServerClient();
  const [queryEmbedding, profileResult] = await Promise.all([
    embedText(message),
    db.from("user_profiles").select("skills").eq("user_id", user.id).single(),
  ]);

  const { data: blocks } = await db.rpc("match_user_experience_blocks", {
    p_user_id: user.id,
    query_embedding: queryEmbedding,
    match_count: 5,
  });

  const skills = (profileResult.data?.skills as Record<string, number>) ?? {};
  const context = buildContext((blocks as ExperienceRow[]) ?? [], skills);
  const systemPrompt = CONVERSE_PROMPT_TEMPLATE.replace("{{RETRIEVED_CONTEXT}}", context);

  const encoder = new TextEncoder();

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const messages: Anthropic.MessageParam[] = [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];

      try {
        while (true) {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1024,
            system: systemPrompt,
            tools: [converseRedirectTool],
            messages,
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }

          const finalMsg = await stream.finalMessage();
          messages.push({ role: "assistant", content: finalMsg.content });

          if (finalMsg.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of finalMsg.content) {
            if (block.type !== "tool_use") continue;
            if (block.name === "redirect") {
              const input = block.input as { url: string; reason: string };
              controller.enqueue(
                encoder.encode(
                  REDIRECT_MARKER_PREFIX +
                    JSON.stringify({ url: input.url, label: "Open link", reason: input.reason, open_in_new_tab: true }) +
                    REDIRECT_MARKER_SUFFIX
                )
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true }),
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
