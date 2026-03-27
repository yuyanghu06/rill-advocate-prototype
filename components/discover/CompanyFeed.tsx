"use client";

import { useEffect, useState } from "react";
import CompanyCard from "./CompanyCard";

type JobOpening = {
  block_id: string;
  title: string;
  embedded_text: string;
  helper_urls: string[];
  date_range: string | null;
};

type CompanyProfile = {
  user_id: string;
  display_name: string | null;
  company_name: string | null;
  headline: string | null;
  top_skills: string[];
  ranking_score: number;
  job_openings: JobOpening[];
};

export default function CompanyFeed() {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/discover/companies")
      .then((r) => r.json())
      .then((data) => setCompanies(data.results ?? []))
      .catch(() => setError("Failed to load companies."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-700">Companies hiring on Rill</h2>
        <p className="text-xs text-slate-400 mt-0.5">Browse open roles from recruiters on the platform</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse">
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-2">
            <p className="text-sm font-medium text-slate-600">No companies yet</p>
            <p className="text-xs text-slate-400">Recruiters haven&apos;t posted roles on Rill yet — check back soon.</p>
          </div>
        )}

        {!loading && companies.length > 0 && (
          <>
            <p className="text-xs text-slate-400 mb-4">
              {companies.length} compan{companies.length !== 1 ? "ies" : "y"} hiring
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {companies.map((c) => (
                <CompanyCard key={c.user_id} company={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
