import RankingBadge from "@/components/profile/RankingBadge";
import type { RankedCandidate } from "@/types";

type Props = { candidate: RankedCandidate };

export default function CandidateCard({ candidate }: Props) {
  const { user_id, display_name, ranking_score, matching_blocks, similarity } =
    candidate;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 font-bold text-sm">
              {(display_name ?? user_id).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">
              {display_name ?? `Candidate ${user_id.slice(0, 8)}`}
            </p>
            <p className="text-xs text-slate-400">
              {similarity !== undefined
                ? `${Math.round(similarity * 100)}% match`
                : null}
            </p>
          </div>
        </div>
        <RankingBadge score={ranking_score} />
      </div>

      {/* Top matching blocks */}
      <div className="space-y-2">
        {matching_blocks.slice(0, 2).map((block) => (
          <div
            key={block.block_id}
            className="bg-slate-50 rounded-xl px-4 py-3"
          >
            <p className="text-xs font-semibold text-slate-700">
              {block.title}
              {block.date_range && (
                <span className="font-normal text-slate-400 ml-1">
                  · {block.date_range}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
              {block.overview}
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

      {/* View full profile */}
      <a
        href={`/profile/${user_id}`}
        className="block text-center text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
      >
        View full profile →
      </a>
    </div>
  );
}
