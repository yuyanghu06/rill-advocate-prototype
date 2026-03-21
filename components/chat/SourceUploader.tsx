"use client";

import { useRef, useState } from "react";

type Props = {
  onSourceSubmit: (type: "linkedin" | "github" | "other", url: string) => void;
  onResumeText: (text: string, filename: string) => void;
};

type Tab = "url" | "pdf";

export default function SourceUploader({ onSourceSubmit, onResumeText }: Props) {
  const [tab, setTab] = useState<Tab>("pdf");

  // URL tab state
  const [url, setUrl] = useState("");
  const [urlType, setUrlType] = useState<"linkedin" | "github" | "other">("linkedin");

  // PDF tab state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onSourceSubmit(urlType, url.trim());
    setUrl("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.type !== "application/pdf") {
      setError("Please select a PDF file.");
      setFile(null);
    } else {
      setFile(picked);
    }
  }

  async function handlePdfSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/resume", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }

      onResumeText(json.text, file.name);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(["pdf", "url"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-medium py-2 transition-colors ${
              tab === t
                ? "bg-white text-slate-800 border-b-2 border-brand-500"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "pdf" ? "Upload Resume (PDF)" : "Add URL"}
          </button>
        ))}
      </div>

      {/* PDF upload */}
      {tab === "pdf" && (
        <form onSubmit={handlePdfSubmit} className="p-2 space-y-2">
          <div
            className="flex items-center justify-between gap-2 bg-white border border-dashed border-slate-300 rounded-lg px-3 py-2 cursor-pointer hover:border-brand-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-xs text-slate-500 truncate">
              {file ? file.name : "Click to choose a PDF…"}
            </span>
            <span className="text-xs text-brand-500 font-medium flex-shrink-0">Browse</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && <p className="text-xs text-red-500 px-1">{error}</p>}

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full text-xs bg-brand-500 disabled:bg-slate-200 text-white disabled:text-slate-400 py-1.5 rounded-lg transition-colors"
          >
            {uploading ? "Extracting text…" : "Upload & extract"}
          </button>
        </form>
      )}

      {/* URL input */}
      {tab === "url" && (
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 p-2">
          <select
            value={urlType}
            onChange={(e) => setUrlType(e.target.value as typeof urlType)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none"
          >
            <option value="linkedin">LinkedIn</option>
            <option value="github">GitHub</option>
            <option value="other">Other</option>
          </select>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a URL…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="text-xs bg-brand-500 disabled:bg-slate-200 text-white disabled:text-slate-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
