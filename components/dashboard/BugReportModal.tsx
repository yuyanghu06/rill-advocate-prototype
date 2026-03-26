"use client";

import { useState, useRef } from "react";

type Props = {
  onClose: () => void;
};

const MAX_FILES = 3;
const MAX_SIZE_MB = 5;

export default function BugReportModal({ onClose }: Props) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles]           = useState<File[]>([]);
  const [previews, setPreviews]     = useState<string[]>([]);
  const [status, setStatus]         = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg]     = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const valid = Array.from(incoming).filter(
      (f) => allowed.includes(f.type) && f.size <= MAX_SIZE_MB * 1024 * 1024
    );
    const next = [...files, ...valid].slice(0, MAX_FILES);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(i: number) {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setStatus("submitting");
    setErrorMsg("");

    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("page_url", window.location.href);
    files.forEach((f) => form.append("screenshots", f));

    try {
      const res = await fetch("/api/bug-report", { method: "POST", body: form });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? "Submission failed");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Report a bug</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-slate-800">Report submitted</p>
            <p className="text-sm text-slate-400">Thanks — we'll look into it.</p>
            <button
              onClick={onClose}
              className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto max-h-[80vh]">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the issue"
                maxLength={120}
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder:text-slate-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What did you expect? Steps to reproduce…"
                rows={4}
                required
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Screenshots */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Screenshots <span className="text-slate-400 font-normal">(up to {MAX_FILES}, max {MAX_SIZE_MB} MB each)</span>
              </label>

              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {files.length < MAX_FILES && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 hover:border-slate-400 rounded-lg px-3 py-2 transition-colors w-full justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Attach screenshot
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </>
              )}
            </div>

            {/* Error */}
            {status === "error" && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1 pb-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting" || !title.trim() || !description.trim()}
                className="text-sm font-medium bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {status === "submitting" ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
