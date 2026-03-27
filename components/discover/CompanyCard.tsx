"use client";

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

export default function CompanyCard({ company }: { company: CompanyProfile }) {
  const name = company.company_name || company.display_name || "Unknown Company";
  const initials = name.slice(0, 2).toUpperCase();
  const openings = company.job_openings.slice(0, 3);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-brand-700">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
          {company.headline && (
            <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[200px]">
              {company.headline}
            </p>
          )}
        </div>
        <span className="ml-auto text-[10px] text-slate-400 flex-shrink-0">
          {company.job_openings.length} opening{company.job_openings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Required skills */}
      {company.top_skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {company.top_skills.slice(0, 5).map((s) => (
            <span
              key={s}
              className="text-[11px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Job openings preview */}
      {openings.length > 0 && (
        <div className="space-y-2">
          {openings.map((job) => (
            <div key={job.block_id} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
              <p className="text-xs font-medium text-slate-700 truncate">{job.title}</p>
              {job.date_range && (
                <p className="text-[10px] text-slate-400 mt-0.5">{job.date_range}</p>
              )}
              {job.embedded_text && (
                <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                  {job.embedded_text}
                </p>
              )}
              {job.helper_urls?.[0] && (
                <a
                  href={job.helper_urls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1.5 text-[11px] text-brand-600 hover:text-brand-700 font-medium"
                >
                  Apply →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {openings.length === 0 && (
        <p className="text-xs text-slate-400 italic">No open roles listed yet.</p>
      )}
    </div>
  );
}
