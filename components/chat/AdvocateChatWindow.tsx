"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble, { type Message } from "./MessageBubble";
import { processStream } from "@/lib/streamMarkers";
import type { RedirectPayload } from "@/lib/tools";

type HistoryEntry = { role: "user" | "assistant"; content: string };

type Props = {
  targetUserId?: string;
  candidateName?: string;
};

export default function AdvocateChatWindow({ targetUserId, candidateName }: Props = {}) {
  const isRecruiterMode = !!targetUserId;
  const subjectName = isRecruiterMode ? (candidateName ?? "this candidate") : "your";
  const apostrophe = isRecruiterMode ? "'s" : "";
  const greeting = `I'm Advocate — ask me anything about ${subjectName}${apostrophe} experiences, projects, or skills.`;

  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "advocate", content: greeting },
  ]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingRedirects, setPendingRedirects] = useState<RedirectPayload[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyIdRef = useRef<string>("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming, pendingRedirects]);

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setPendingRedirects([]);

    const replyId = `reply-${Date.now()}`;
    replyIdRef.current = replyId;
    setMessages((prev) => [...prev, { id: replyId, role: "advocate", content: "" }]);

    let fullText = "";

    try {
      const res = await fetch("/api/advocate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history, targetUserId }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let rawAccum = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawAccum += decoder.decode(value, { stream: true });

        const { bubbles, redirects } = processStream(rawAccum);
        const content = bubbles[0] ?? "";
        fullText = content;

        setMessages((prev) =>
          prev.map((m) => (m.id === replyId ? { ...m, content } : m))
        );

        if (redirects.length > 0) {
          setPendingRedirects((prev) => {
            const existingUrls = new Set(prev.map((r) => r.url));
            const newOnes = redirects.filter((r) => !existingUrls.has(r.url));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      }

      // Update conversation history for next turn
      setHistory((prev) => [
        ...prev,
        { role: "user", content: text.trim() },
        { role: "assistant", content: fullText },
      ]);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId ? { ...m, content: "Something went wrong. Please try again." } : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
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

        {/* Typing indicator */}
        {isStreaming && lastMsgContent === "" && (
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

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-100 px-4 py-3 bg-white">
        <div className="flex items-end gap-2">
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
            disabled={isStreaming}
            placeholder={`Ask about ${subjectName}${apostrophe} experiences, skills, or projects…`}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 leading-relaxed disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
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
