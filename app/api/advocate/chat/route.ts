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
 * POST /api/advocate
 *
 * RAG chat about the authenticated user's own profile.
 * 1. Embed the user's message.
 * 2. Query experience_blocks (top 5 by cosine similarity) + fetch skills.
 * 3. Build the context block and inject into prompts/advocate-chat.md.
 * 4. Stream Claude's response; execute the redirect tool client-side via markers.
 *
 * Body: { message: string; history: { role: "user" | "assistant"; content: string }[] }
 */

const ADVOCATE_PROMPT_TEMPLATE = readFileSync(
  join(process.cwd(), "prompts", "advocate.md"),
  "utf-8"
);

// Used when a recruiter is querying about someone else's profile.
const RECRUITER_ADVOCATE_PROMPT_TEMPLATE = `You are Advocate, a talent intelligence assistant on the Rill platform. You have deep knowledge of a specific candidate's professional experiences, projects, and skills because their profile was built from sources they shared — their resume, GitHub, LinkedIn, and structured onboarding conversations.

Your job is to answer questions a recruiter asks about this candidate: their experiences, skills, career trajectory, projects, and the stories behind their work.

**Tone:** Informative, objective, concise. Refer to the candidate by name or as "they/them". Never speculate beyond what the retrieved profile contains.

**Scope:** You only answer questions about this specific candidate based on their retrieved profile data below. If asked about something outside the retrieved context, decline: "I only have context on this candidate's profile — I can't answer that."

**Using the redirect tool:** If a helper URL, GitHub repo, deployed project link, or source URL from the retrieved context would help the recruiter evaluate the candidate, call the \`redirect\` tool. Only use URLs that appear in the retrieved context.

{{RETRIEVED_CONTEXT}}`;

const advocateRedirectTool: Anthropic.Tool = {
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

function buildContext(blocks: ExperienceRow[], skills: Record<string, number>, candidateName?: string): string {
  const lines: string[] = ["--- RETRIEVED CONTEXT ---", ""];
  if (candidateName) lines.push(`Candidate: ${candidateName}`, "");

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

  const { message, history = [], targetUserId } = await req.json() as {
    message: string;
    history: HistoryMessage[];
    targetUserId?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Use the target candidate's profile when provided; otherwise the auth user's own profile.
  const db = getServerClient();
  const subjectId = targetUserId ?? user.id;
  const isRecruiterMode = !!targetUserId && targetUserId !== user.id;

  const [queryEmbedding, profileResult] = await Promise.all([
    embedText(message),
    db.from("user_profiles")
      .select("skills, display_name")
      .eq("user_id", subjectId)
      .single(),
  ]);

  const { data: blocks } = await db.rpc("match_user_experience_blocks", {
    p_user_id: subjectId,
    query_embedding: queryEmbedding,
    match_count: 5,
  });

  const skills = (profileResult.data?.skills as Record<string, number>) ?? {};
  const candidateName = isRecruiterMode
    ? (profileResult.data?.display_name ?? undefined)
    : undefined;
  const context = buildContext((blocks as ExperienceRow[]) ?? [], skills, candidateName);
  const template = isRecruiterMode
    ? RECRUITER_ADVOCATE_PROMPT_TEMPLATE
    : ADVOCATE_PROMPT_TEMPLATE;
  const systemPrompt = template.replace("{{RETRIEVED_CONTEXT}}", context);

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
            tools: [advocateRedirectTool],
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
