const SOURCE_LABELS: Record<string, string> = {
  resume:   "Resume",
  linkedin: "LinkedIn",
  github:   "GitHub",
  other:    "Other",
};

type Props = {
  title: string;
  overview: string;
  date_range?: string | null;
  source_type: string;
  helper_urls: string[];
};

export default function ExperienceBlock({
  title,
  overview,
  date_range,
  source_type,
  helper_urls,
}: Props) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 text-base leading-snug">{title}</h3>
          {date_range && (
            <p className="text-xs text-slate-400 mt-0.5">{date_range}</p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
          {SOURCE_LABELS[source_type] ?? source_type}
        </span>
      </div>

      {/* Overview */}
      <p className="text-sm text-slate-600 leading-relaxed">{overview}</p>

      {/* Helper URLs */}
      {helper_urls.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {helper_urls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-100 px-2.5 py-1 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.1m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {new URL(url).hostname.replace("www.", "")}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
