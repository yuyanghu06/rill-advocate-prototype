"use client";

import { useState } from "react";
import Link from "next/link";
import CandidateCard from "@/components/recruiter/CandidateCard";
import type { RankedCandidate } from "@/types";

const EXAMPLE_QUERIES = [
  "Full-stack engineers who've shipped consumer products",
  "ML engineers with PyTorch and published research",
  "Mobile developers with React Native and App Store launches",
];

export default function RecruiterPage() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(q = query) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setSearched(true);
    setError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Search failed");
      }

      const { candidates: results } = await res.json();
      setCandidates(results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            rill<span className="text-brand-500">.</span>
          </Link>
          <Link
            href="/onboarding"
            className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Build my profile
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Find your next hire
          </h1>
          <p className="text-slate-500">
            Describe what you're looking for in plain English.
          </p>
        </div>

        {/* Search box */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-4">
          <div className="flex items-end gap-3">
            <textarea
              rows={2}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="e.g. Backend engineers with Go and distributed systems experience who've worked at scale"
              className="flex-1 resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none leading-relaxed"
            />
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim() || loading}
              className="flex-shrink-0 bg-brand-500 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </div>

        {/* Example queries */}
        {!searched && (
          <div className="flex flex-wrap gap-2 mb-10">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleSearch(q)}
                className="text-xs text-slate-500 hover:text-brand-600 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 px-3 py-1.5 rounded-full transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {searched && !loading && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              {candidates.length > 0
                ? `${candidates.length} candidate${candidates.length !== 1 ? "s" : ""} found`
                : "No candidates matched your query. Try broadening your search."}
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map((c) => (
                <CandidateCard key={c.user_id} candidate={c} />
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-16 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
