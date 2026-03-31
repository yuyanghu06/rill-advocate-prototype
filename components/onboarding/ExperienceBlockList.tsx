"use client";

import { useEffect, useRef, useState } from "react";

type Block = {
  block_id: string;
  title: string;
  source_type: string;
  embedded_text: string;
  source_url: string;
  helper_urls: string[];
};

const SOURCE_ICONS: Record<string, string> = {
  resume: "📄",
  linkedin: "💼",
  github: "🐙",
  manual: "✏️",
  other: "🔗",
};

function BlockDetail({ block, onClose, is_recruiter = false }: { block: Block; onClose: () => void; is_recruiter?: boolean }) {
  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const urls = [
    ...(block.source_url ? [{ label: "Source", href: block.source_url }] : []),
    ...block.helper_urls.map((u) => ({ label: u, href: u })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg flex-shrink-0" aria-hidden>
              {SOURCE_ICONS[block.source_type] ?? "📌"}
            </span>
            <h2 className="text-sm font-semibold text-slate-800 leading-snug">
              {block.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Overview */}
        <p className="text-sm text-slate-600 leading-relaxed">
          {block.embedded_text}
        </p>

        {/* URLs */}
        {urls.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{is_recruiter ? "Application Links" : "Links"}</p>
            <div className="space-y-1">
              {urls.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700 truncate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="truncate">{label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {urls.length === 0 && (
          <p className="text-xs text-slate-400 italic">{is_recruiter ? "No application link yet — share a job posting or ATS URL in the chat." : "No links yet — share a repo or demo URL in the chat to boost your ranking."}</p>
        )}
      </div>
    </div>
  );
}

export default function ExperienceBlockList({ userId, is_recruiter = false }: { userId: string; is_recruiter?: boolean }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selected, setSelected] = useState<Block | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function fetchBlocks() {
      try {
        const res = await fetch(`/api/profile/${userId}`);
        if (!res.ok || cancelled) return;
        const { blocks: fetched } = await res.json();
        if (!Array.isArray(fetched) || cancelled) return;
        setBlocks(fetched);
        // Keep selected block in sync with latest data
        if (selected) {
          const updated = fetched.find((b: Block) => b.block_id === selected.block_id);
          if (updated) setSelected(updated);
        }
        fetched.forEach((b: Block) => seenIds.current.add(b.block_id));
      } catch {
        // network error — silently retry on next interval
      }
    }

    fetchBlocks();
    const interval = setInterval(fetchBlocks, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (blocks.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center px-3"
          >
            <span className="text-xs text-slate-400">{is_recruiter ? `Job opening ${i}` : `Experience block ${i}`}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {blocks.map((block) => (
          <button
            key={block.block_id}
            onClick={() => setSelected(block)}
            className="w-full bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 flex items-center px-3 py-2.5 animate-fade-in transition-colors text-left"
          >
            <span className="text-xs font-medium text-slate-700 truncate leading-tight">
              {block.title}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <BlockDetail block={selected} onClose={() => setSelected(null)} is_recruiter={is_recruiter} />
      )}
    </>
  );
}
