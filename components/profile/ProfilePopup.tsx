"use client";

import { useState } from "react";

type Props = {
  userId: string;
  candidateName?: string;
};

export default function ProfilePopup({ userId, candidateName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-600 hover:text-brand-800 border border-brand-200 hover:border-brand-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        View profile →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-700">
                {candidateName ? `${candidateName}'s Profile` : "Candidate Profile"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profile iframe */}
            <iframe
              src={`/profile/${userId}`}
              className="flex-1 w-full"
              title={candidateName ? `${candidateName}'s profile` : "Candidate profile"}
            />
          </div>
        </div>
      )}
    </>
  );
}
