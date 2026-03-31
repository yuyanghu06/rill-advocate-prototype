"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble, { type Message } from "./MessageBubble";
import SourceUploader from "./SourceUploader";
import type { RedirectPayload } from "@/lib/tools";
import { processStream } from "@/lib/streamMarkers";
import { REDIRECT_MARKER_PREFIX as REDIRECT_PREFIX, REDIRECT_MARKER_SUFFIX as REDIRECT_SUFFIX } from "@/lib/tools/redirectUser";

// Strip <finalize>…</finalize> blocks from display text.
function stripFinalizeTag(text: string): string {
  return text.replace(/<finalize>[\s\S]*?<\/finalize>/g, "").trim();
}

// Used only when loading stored messages from Redis (markers are not persisted,
// but kept as a safety pass in case any stray markers slip through).
function extractRedirects(raw: string): { text: string; redirects: RedirectPayload[] } {
  const redirects: RedirectPayload[] = [];
  const text = raw.replace(
    new RegExp(
      `${REDIRECT_PREFIX.replace(/\x00/g, "\\x00")}([\\s\\S]*?)${REDIRECT_SUFFIX.replace(/\x00/g, "\\x00")}`,
      "g"
    ),
    (_, json) => {
      try { redirects.push(JSON.parse(json)); } catch { /* skip */ }
      return "";
    }
  );
  return { text, redirects };
}

const TOOL_LABELS_CANDIDATE: Record<string, string> = {
  save_experience_block: "Saving experience",
  update_experience_block: "Updating experience",
  upsert_skills: "Updating skills",
  fetch_github_repos: "Fetching GitHub data",
  redirect_user: "Preparing link",
};

const TOOL_LABELS_RECRUITER: Record<string, string> = {
  save_experience_block: "Saving job opening",
  update_experience_block: "Updating job opening",
  upsert_skills: "Updating required skills",
  fetch_github_repos: "Fetching GitHub data",
  redirect_user: "Preparing link",
};

const CANDIDATE_GREETING =
  "Hey! I'm Advocate — I'll help you build a profile that gets you noticed by the right recruiters.\n\nTo get started, share any of the following:\n• Your resume (paste the text below)\n• Your LinkedIn URL\n• Your GitHub URL\n\nYou can share as many or as few as you have. What would you like to start with?";

const RECRUITER_GREETING =
  "Hey! I'm Advocate — I'll help candidates get to know more about your company.\n\nTo get started, share any of the following:\n• A job description (paste text or upload a PDF)\n• Your company's careers page or ATS URL\n• A specific job posting URL\n\nYou can add as many open roles as you'd like. What would you like to start with?";

const RESUME_PREFIX = "Here is my resume:\n\n";
const JD_PREFIX = "Here is a job description:\n\n";

export default function ChatWindow({ userId, is_recruiter = false }: { userId: string; is_recruiter?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [pendingRedirects, setPendingRedirects] = useState<RedirectPayload[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Tracks the IDs of advocate reply bubbles for the current streaming turn.
  const replyIdsRef = useRef<string[]>([]);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, toolStatus, pendingRedirects]);

  async function loadSession() {
    if (!userId) return;

    const res = await fetch(`/api/onboarding/session?userId=${userId}`);
    const { session } = await res.json();

    if (session?.messages?.length) {
      function extractText(content: string | { type: string; text?: string }[]): string {
        if (typeof content === "string") return content;
        return content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
      }

      const loaded: Message[] = session.messages
        .map((m: { role: string; content: string | { type: string; text?: string }[] }, i: number) => {
          const rawText = extractText(m.content);
          if (!rawText) return null;

          const content = stripFinalizeTag(extractRedirects(rawText).text);
          if (m.role === "user" && rawText.startsWith(RESUME_PREFIX)) {
            const bodyText = rawText.slice(RESUME_PREFIX.length);
            const wordCount = bodyText.trim().split(/\s+/).length;
            return { id: String(i), role: "user" as const, content, display: `📄 Resume — ${wordCount.toLocaleString()} words` };
          }
          if (m.role === "user" && rawText.startsWith(JD_PREFIX)) {
            const bodyText = rawText.slice(JD_PREFIX.length);
            const wordCount = bodyText.trim().split(/\s+/).length;
            return { id: String(i), role: "user" as const, content, display: `📄 Job description — ${wordCount.toLocaleString()} words` };
          }
          return {
            id: String(i),
            role: m.role === "user" ? "user" : "advocate",
            content,
          };
        })
        .filter((m: Message | null): m is Message => m !== null);
      setMessages(loaded);
      if (session.step === "complete") setSessionComplete(true);
    } else {
      setMessages([{ id: "0", role: "advocate", content: is_recruiter ? RECRUITER_GREETING : CANDIDATE_GREETING }]);
    }
  }

  async function sendMessage(text: string, display?: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      ...(display ? { display } : {}),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setPendingRedirects([]);

    // Initialize the first reply bubble
    const firstReplyId = `reply-${Date.now()}-0`;
    replyIdsRef.current = [firstReplyId];
    setMessages((prev) => [...prev, { id: firstReplyId, role: "advocate", content: "" }]);

    try {
      const res = await fetch("/api/advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text.trim() }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawAccum = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawAccum += decoder.decode(value, { stream: true });

        const { bubbles, toolStatus: status, redirects } = processStream(rawAccum);

        // Capture how many bubbles existed before this iteration
        const prevCount = replyIdsRef.current.length;

        // Allocate IDs for any new bubbles discovered in this chunk
        for (let i = prevCount; i < bubbles.length; i++) {
          replyIdsRef.current.push(`reply-${Date.now()}-${i}`);
        }

        // Add new placeholder messages and update all bubble contents atomically
        setMessages((prev) => {
          let next = [...prev];
          for (let i = prevCount; i < replyIdsRef.current.length; i++) {
            next = [...next, { id: replyIdsRef.current[i], role: "advocate", content: "" }];
          }
          return next.map((m) => {
            const idx = replyIdsRef.current.indexOf(m.id);
            if (idx === -1 || idx >= bubbles.length) return m;
            const content = stripFinalizeTag(bubbles[idx]);
            return content !== m.content ? { ...m, content } : m;
          });
        });

        setToolStatus(status);

        if (redirects.length > 0) {
          setPendingRedirects((prev) => {
            const existingUrls = new Set(prev.map((r) => r.url));
            const newOnes = redirects.filter((r) => !existingUrls.has(r.url));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      }

      if (/<finalize>/i.test(rawAccum)) {
        setSessionComplete(true);
      }
    } catch {
      const lastId = replyIdsRef.current[replyIdsRef.current.length - 1];
      if (lastId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === lastId
              ? { ...m, content: "Something went wrong. Please try again." }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setToolStatus(null);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const res = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId }),
      });
      if (res.ok) setFinalized(true);
    } finally {
      setFinalizing(false);
    }
  }

  function handleSourceSubmit(type: "linkedin" | "github" | "other", url: string) {
    const label = { linkedin: "LinkedIn", github: "GitHub", other: "Link" }[type];
    let hostname = url;
    try { hostname = new URL(url).hostname.replace("www.", ""); } catch { /* keep raw */ }
    const message = is_recruiter
      ? `Here is our company ${type === "other" ? "page" : type + " page"}: ${url}`
      : `Here is my ${type} profile: ${url}`;
    sendMessage(message, `🔗 ${label} added — ${hostname}`);
    setShowUploader(false);
  }

  function handleResumeText(text: string, filename: string) {
    const wordCount = text.trim().split(/\s+/).length;
    if (is_recruiter) {
      sendMessage(`${JD_PREFIX}${text}`, `📄 ${filename} — job description, ${wordCount.toLocaleString()} words`);
    } else {
      sendMessage(`${RESUME_PREFIX}${text}`, `📄 ${filename} — ${wordCount.toLocaleString()} words`);
    }
    setShowUploader(false);
  }

  const lastMsgContent = messages[messages.length - 1]?.content;

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) =>
          msg.role === "advocate" && msg.content === "" ? null : (
            <MessageBubble key={msg.id} message={msg} />
          )
        )}

        {/* Tool status indicator — shown while a tool call is in flight */}
        {isStreaming && toolStatus && (
          <div className="flex items-center gap-2 pl-9">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse flex-shrink-0" />
            <span className="text-xs text-slate-400 italic">
              {(is_recruiter ? TOOL_LABELS_RECRUITER : TOOL_LABELS_CANDIDATE)[toolStatus] ?? toolStatus}…
            </span>
          </div>
        )}

        {/* Typing indicator — shown while waiting for the first token of a new bubble */}
        {isStreaming && !toolStatus && lastMsgContent === "" && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div className="bg-white border border-slate-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {/* Redirect link buttons */}
        {pendingRedirects.map((r) => (
          <div key={r.url} className="flex justify-start pl-9">
            <a
              href={r.url}
              target={r.open_in_new_tab ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {r.label}
            </a>
          </div>
        ))}

        {/* Finalize CTA */}
        {sessionComplete && !finalized && (
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm font-medium text-brand-800">
              {is_recruiter ? "Your company profile is ready to save!" : "Your profile is ready to save!"}
            </p>
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm px-6 py-2.5 rounded-xl transition-colors"
            >
              {finalizing ? "Saving…" : is_recruiter ? "Confirm & save company profile" : "Confirm & save profile"}
            </button>
          </div>
        )}

        {finalized && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-emerald-700">
              {is_recruiter
                ? "Company profile saved! Candidates can now discover your open roles."
                : "Profile saved! You're now discoverable by recruiters."}
            </p>
            <a
              href={`/profile/${userId}`}
              className="inline-block mt-2 text-xs text-emerald-600 hover:underline"
            >
              {is_recruiter ? "View your company profile →" : "View your profile →"}
            </a>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Source uploader */}
      {showUploader && (
        <div className="px-4 pb-2">
          <SourceUploader
            onSourceSubmit={handleSourceSubmit}
            onResumeText={handleResumeText}
          />
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-slate-100 px-4 py-3 bg-white">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowUploader((v) => !v)}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-brand-500 hover:border-brand-300 transition-colors"
            title="Add a URL or upload resume"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.1m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={isStreaming || finalized}
            placeholder={finalized ? "Profile saved." : "Message Advocate…"}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 leading-relaxed disabled:bg-slate-50 disabled:text-slate-400"
          />

          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || finalized}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-brand-500 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
