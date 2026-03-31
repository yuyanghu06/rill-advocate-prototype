"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import CandidateCard from "@/components/recruiter/CandidateCard";
import CompanyFeed from "@/components/discover/CompanyFeed";
import type { DiscoverCandidate, DiscoverFilters } from "@/types";

type View = "candidates" | "companies";

const SORT_OPTIONS = [
  { value: "best_match", label: "Best Match" },
  { value: "most_credible", label: "Most Credible" },
  { value: "most_experience", label: "Most Experience" },
  { value: "most_verified", label: "Most Verified" },
];

const DEFAULT_FILTERS: DiscoverFilters = {
  skills: [],
  min_ranking: 0,
  has_github: false,
  has_linkedin: false,
};

type SearchParams = {
  query: string;
  filters: DiscoverFilters;
  alpha: number;
  sort: string;
};

export default function DiscoverSearch({ is_recruiter = false }: { is_recruiter?: boolean }) {
  // Recruiters default to browsing candidates; candidates default to browsing companies.
  const [view, setView] = useState<View>(is_recruiter ? "candidates" : "companies");

  const [query, setQuery] = useState("");
  const [alpha, setAlpha] = useState(0.65);
  const [sort, setSort] = useState("best_match");
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [skillInput, setSkillInput] = useState("");

  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all candidate profiles when switching to candidates view for the first time.
  useEffect(() => {
    if (view === "candidates" && !searched) {
      runSearch({ query: "", filters: DEFAULT_FILTERS, alpha: 0.65, sort: "best_match" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const runSearch = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const res = await fetch("/api/discover/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: params.query,
          filters: params.filters,
          alpha: params.alpha,
          sort: params.sort,
          page: 1,
          page_size: 20,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Search failed");
      }
      const data = await res.json();
      setCandidates(data.results ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function scheduleSearch(overrides: Partial<SearchParams> = {}) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params: SearchParams = { query, filters, alpha, sort, ...overrides };
    debounceRef.current = setTimeout(() => runSearch(params), 350);
  }

  function handleQueryChange(q: string) {
    setQuery(q);
    scheduleSearch({ query: q });
  }

  function handleSubmit(q = query) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(q);
    runSearch({ query: q, filters, alpha, sort });
  }

  function handleFilterChange(patch: Partial<DiscoverFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    scheduleSearch({ filters: next });
  }

  function handleAlphaChange(a: number) {
    setAlpha(a);
    scheduleSearch({ alpha: a });
  }

  function handleSortChange(s: string) {
    setSort(s);
    scheduleSearch({ sort: s });
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !filters.skills.includes(s)) {
      handleFilterChange({ skills: [...filters.skills, s] });
    }
    setSkillInput("");
  }

  function removeSkill(s: string) {
    handleFilterChange({ skills: filters.skills.filter((x) => x !== s) });
  }

  const activeFilterCount =
    filters.skills.length +
    (filters.has_github ? 1 : 0) +
    (filters.has_linkedin ? 1 : 0) +
    (filters.min_ranking > 0 ? 1 : 0);

  const queryTerms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const alphaModeLabel =
    alpha < 0.3 ? "Keyword-heavy" : alpha > 0.75 ? "Semantic-heavy" : "Balanced";

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex gap-2 items-center">
          {/* View toggle — visible to all users */}
          <div className="flex-shrink-0 flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
            {(["candidates", "companies"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  view === v
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Candidate search controls — only shown in candidates view */}
          {view === "candidates" && (
            <>
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
                  filtersOpen
                    ? "bg-brand-50 border-brand-200 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 gap-2 focus-within:border-brand-300 focus-within:ring-1 focus-within:ring-brand-200 transition-all">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Describe who you're looking for…"
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setCandidates([]); setSearched(false); }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className="flex-shrink-0 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm px-4 py-2 rounded-xl transition-colors"
              >
                {loading ? "…" : "Search"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Companies view */}
      {view === "companies" && <CompanyFeed embedded />}

      {/* Candidates view */}
      {view === "candidates" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Filter panel */}
          {filtersOpen && (
            <aside className="w-60 flex-shrink-0 bg-white border-r border-slate-100 overflow-y-auto px-4 py-4 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Filters</span>
                <button onClick={() => setFiltersOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sort */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Sort by</label>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Search mode */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Search mode</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={alpha}
                  onChange={(e) => handleAlphaChange(parseFloat(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Keyword</span>
                  <span className="text-brand-600 font-medium">{alphaModeLabel}</span>
                  <span>Semantic</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {alpha < 0.3
                    ? 'Best for exact skill names like "Rust" or "dbt".'
                    : alpha > 0.75
                    ? 'Best for role descriptions like "leads infra migrations".'
                    : "Balances exact terms with meaning."}
                </p>
              </div>

              {/* Min credibility */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Min credibility: <span className="text-slate-800">{filters.min_ranking}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={filters.min_ranking}
                  onChange={(e) => handleFilterChange({ min_ranking: parseInt(e.target.value) })}
                  className="w-full accent-brand-500"
                />
              </div>

              {/* Skills */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">Must-have skills</label>
                {filters.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {filters.skills.map((s) => (
                      <span key={s} className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                        {s}
                        <button onClick={() => removeSkill(s)} className="text-brand-400 hover:text-brand-700 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    placeholder="e.g. React"
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <button onClick={addSkill} className="text-xs bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">Add</button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {(
                  [
                    { key: "has_github", label: "Has GitHub link" },
                    { key: "has_linkedin", label: "Has LinkedIn link" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{label}</span>
                    <button
                      role="switch"
                      aria-checked={filters[key]}
                      onClick={() => handleFilterChange({ [key]: !filters[key] })}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0 ${filters[key] ? "bg-brand-500" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${filters[key] ? "translate-x-4" : ""}`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setAlpha(0.65);
                    setSort("best_match");
                    scheduleSearch({ filters: DEFAULT_FILTERS, alpha: 0.65, sort: "best_match" });
                  }}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 border border-slate-200 hover:border-slate-300 py-1.5 rounded-lg transition-colors"
                >
                  Reset filters
                </button>
              )}
            </aside>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            {loading && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-5 bg-slate-100 rounded-full w-16" />
                      <div className="h-5 bg-slate-100 rounded-full w-12" />
                      <div className="h-5 bg-slate-100 rounded-full w-20" />
                    </div>
                    <div className="h-16 bg-slate-100 rounded-xl" />
                    <div className="h-16 bg-slate-100 rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {searched && !loading && (
              <>
                <p className="text-xs text-slate-400 mb-4">
                  {candidates.length > 0
                    ? `${total} candidate${total !== 1 ? "s" : ""} found`
                    : "No candidates matched — try broadening your search or adjusting filters."}
                </p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {candidates.map((c) => (
                    <CandidateCard key={c.user_id} candidate={c} queryTerms={queryTerms} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
