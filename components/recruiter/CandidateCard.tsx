import Image from "next/image";
import RankingBadge from "@/components/profile/RankingBadge";
import type { DiscoverCandidate, RankedCandidate } from "@/types";

type Props = {
  candidate: RankedCandidate | DiscoverCandidate;
  queryTerms?: string[];
};

function highlight(text: string, terms: string[]): string {
  if (!terms.length) return text;
  const pattern = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return text.replace(new RegExp(`(${pattern})`, "gi"), "**$1**");
}

function renderHighlighted(text: string, terms: string[]) {
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(
    `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-brand-100 text-brand-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function CandidateCard({ candidate, queryTerms = [] }: Props) {
  const dc = candidate as DiscoverCandidate;
  const { user_id, display_name, ranking_score, matching_blocks, similarity } = candidate;
  const avatarUrl = dc.avatar_url;

  const matchPct =
    dc.final_score != null
      ? Math.round(dc.final_score * 100)
      : similarity != null
      ? Math.round(similarity * 100)
      : null;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={display_name ?? "Candidate"}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-brand-700 font-bold text-sm">
                {(display_name ?? user_id).charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
              {display_name ?? `Candidate ${user_id.slice(0, 8)}`}
            </p>
            {dc.headline ? (
              <p className="text-[11px] leading-tight text-slate-400 truncate max-w-[160px]">{dc.headline}</p>
            ) : matchPct != null && queryTerms.length > 0 ? (
              <p className="text-[11px] leading-tight text-slate-400">{matchPct}% match</p>
            ) : null}
          </div>
        </div>
        <RankingBadge score={ranking_score} />
      </div>

      {/* Skill pills */}
      {dc.top_skills && dc.top_skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dc.top_skills.slice(0, 6).map((skill) => {
            const isMatch =
              queryTerms.length > 0 &&
              queryTerms.some((t) =>
                skill.toLowerCase().includes(t.toLowerCase())
              );
            return (
              <span
                key={skill}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  isMatch
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {skill}
              </span>
            );
          })}
        </div>
      )}

      {/* Top matching blocks */}
      <div className="space-y-2 flex-1">
        {matching_blocks.slice(0, 2).map((block) => (
          <div key={block.block_id} className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-700">
              {block.title}
              {block.date_range && (
                <span className="font-normal text-slate-400 ml-1">
                  · {block.date_range}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
              {renderHighlighted(
                block.overview ?? block.embedded_text ?? "",
                queryTerms
              )}
            </p>

            {block.helper_urls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {block.helper_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {new URL(url).hostname.replace("www.", "")} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 gap-3">
        {dc.final_score != null && queryTerms.length > 0 && (
          <span className="text-xs text-slate-400 flex-shrink-0" title="Relevance score">
            {matchPct}% relevant
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <a
            href={`/advocate?with=${user_id}`}
            className="text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors"
          >
            Advocate →
          </a>
          <a
            href={`/profile/${user_id}`}
            className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
          >
            View profile →
          </a>
        </div>
      </div>
    </div>
  );
}
