"use client";

import { useEffect, useState } from "react";
import type { SkillsMap } from "@/types";

type SortOrder = "score" | "alpha";

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= score ? "bg-brand-500" : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function SkillsList({ userId }: { userId: string }) {
  const [skills, setSkills] = useState<SkillsMap>({});
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<SortOrder>("score");

  useEffect(() => {
    let cancelled = false;

    async function fetchSkills() {
      try {
        const res = await fetch(`/api/profile/${userId}`);
        if (!res.ok || cancelled) return;
        const { skills: fetched } = await res.json();
        if (fetched && typeof fetched === "object" && !cancelled) {
          setSkills(fetched);
        }
      } catch {
        // silently retry on next interval
      }
    }

    fetchSkills();
    const interval = setInterval(fetchSkills, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  const entries = Object.entries(skills).sort((a, b) =>
    sort === "alpha" ? a[0].localeCompare(b[0]) : b[1] - a[1]
  );
  const count = entries.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Skills
          </p>
          {count > 0 && (
            <span className="text-xs font-medium text-brand-600 bg-brand-50 rounded-full px-1.5 py-0.5">
              {count}
            </span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {count > 0 && (
            <div className="flex gap-1 px-4 pb-2">
              {(["score", "alpha"] as SortOrder[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                    sort === s
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {s === "score" ? "Score" : "A–Z"}
                </button>
              ))}
            </div>
          )}

          <div className="px-4 max-h-52 overflow-y-auto mb-4">
            <div className="space-y-1.5">
              {count === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No skills identified yet — share your resume or GitHub to get started.
                </p>
              ) : (
                entries.map(([name, score]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 animate-fade-in"
                  >
                    <span className="text-xs font-medium text-slate-700 truncate">{name}</span>
                    <ScoreDots score={score} />
                  </div>
                ))
              )}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
