"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble, { type Message } from "./MessageBubble";
import SourceUploader from "./SourceUploader";

// Strip the <finalize>…</finalize> block before displaying to the user.
function stripFinalizeTag(text: string): string {
  return text.replace(/<finalize>[\s\S]*?<\/finalize>/g, "").trim();
}

function getUserId(): string {
  if (typeof window === "undefined") return "";
  const key = "rill_user_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showUploader, setShowUploader] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string>("");

  // Load userId once on mount, then load existing session
  useEffect(() => {
    userIdRef.current = getUserId();
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function loadSession() {
    const userId = userIdRef.current;
    if (!userId) return;

    const res = await fetch(`/api/onboarding/session?userId=${userId}`);
    const { session } = await res.json();

    if (session?.messages?.length) {
      const loaded: Message[] = session.messages.map(
        (m: { role: string; content: string }, i: number) => ({
          id: String(i),
          role: m.role === "user" ? "user" : "advocate",
          content: stripFinalizeTag(m.content),
        })
      );
      setMessages(loaded);
      if (session.step === "complete") setSessionComplete(true);
    } else {
      // Fresh session — show the opening message
      setMessages([
        {
          id: "0",
          role: "advocate",
          content:
            "Hey! I'm Advocate — I'll help you build a profile that gets you noticed by the right recruiters.\n\nTo get started, share any of the following:\n• Your resume (paste the text below)\n• Your LinkedIn URL\n• Your GitHub URL\n\nYou can share as many or as few as you have. What would you like to start with?",
        },
      ]);
    }
  }

  async function sendMessage(text: string, display?: string) {
    if (!text.trim() || isStreaming) return;

    const userId = userIdRef.current;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      ...(display ? { display } : {}),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Placeholder for the streaming advocate reply
    const replyId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: replyId, role: "advocate", content: "" },
    ]);

    try {
      const res = await fetch("/api/advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, message: text.trim() }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const display = stripFinalizeTag(fullText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, content: display } : m
          )
        );
      }

      // Check if the session is now complete
      if (/<finalize>/i.test(fullText)) {
        setSessionComplete(true);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const res = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current }),
      });
      if (res.ok) setFinalized(true);
    } finally {
      setFinalizing(false);
    }
  }

  function handleSourceSubmit(
    type: "linkedin" | "github" | "other",
    url: string
  ) {
    const label = { linkedin: "LinkedIn", github: "GitHub", other: "Link" }[type];
    let hostname = url;
    try { hostname = new URL(url).hostname.replace("www.", ""); } catch { /* keep raw */ }
    sendMessage(
      `Here is my ${type} profile: ${url}`,
      `🔗 ${label} added — ${hostname}`
    );
    setShowUploader(false);
  }

  function handleResumeText(text: string, filename: string) {
    const wordCount = text.trim().split(/\s+/).length;
    sendMessage(
      `Here is my resume:\n\n${text}`,
      `📄 ${filename} — ${wordCount.toLocaleString()} words`
    );
    setShowUploader(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator — shown only while waiting for first token */}
        {isStreaming && messages[messages.length - 1]?.content === "" && (
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

        {/* Finalize CTA */}
        {sessionComplete && !finalized && (
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm font-medium text-brand-800">
              Your profile is ready to save!
            </p>
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm px-6 py-2.5 rounded-xl transition-colors"
            >
              {finalizing ? "Saving…" : "Confirm & save profile"}
            </button>
          </div>
        )}

        {finalized && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-emerald-700">
              Profile saved! You're now discoverable by recruiters.
            </p>
            <a
              href={`/profile/${userIdRef.current}`}
              className="inline-block mt-2 text-xs text-emerald-600 hover:underline"
            >
              View your profile →
            </a>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Source uploader (toggleable) */}
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
            title="Add a URL"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.1m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
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
            placeholder={
              finalized ? "Profile saved." : "Message Advocate…"
            }
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 leading-relaxed disabled:bg-slate-50 disabled:text-slate-400"
          />

          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || finalized}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-brand-500 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14M12 5l7 7-7 7"
              />
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
