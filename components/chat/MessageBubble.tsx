"use client";

import ReactMarkdown from "react-markdown";

export type Message = {
  id: string;
  role: "advocate" | "user";
  content: string;    // full text sent to the API
  display?: string;   // short blurb shown in the bubble (falls back to content)
};

export default function MessageBubble({ message }: { message: Message }) {
  const isAdvocate = message.role === "advocate";
  const rendered = message.display ?? message.content;

  return (
    <div
      className={`flex items-end gap-2 ${isAdvocate ? "justify-start" : "justify-end"}`}
    >
      {isAdvocate && (
        <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 mb-1">
          <span className="text-white text-xs font-bold">A</span>
        </div>
      )}

      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isAdvocate
            ? "bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm"
            : "bg-brand-500 text-white rounded-br-sm"
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 last:mb-0">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 last:mb-0">{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            code: ({ children }) => <code className="bg-black/10 rounded px-1 font-mono text-xs">{children}</code>,
          }}
        >
          {rendered}
        </ReactMarkdown>
      </div>
    </div>
  );
}
