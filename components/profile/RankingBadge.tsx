type Props = { score: number };

function tier(score: number): { label: string; colors: string } {
  if (score >= 30) return { label: "Elite",    colors: "bg-violet-100 text-violet-700 border-violet-200" };
  if (score >= 20) return { label: "Strong",   colors: "bg-brand-100 text-brand-700 border-brand-200" };
  if (score >= 10) return { label: "Good",     colors: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  return              { label: "Building",  colors: "bg-slate-100 text-slate-500 border-slate-200" };
}

export default function RankingBadge({ score }: Props) {
  const { label, colors } = tier(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 border text-xs font-semibold px-2.5 py-1 rounded-full ${colors}`}
      title={`Ranking score: ${score}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label} · {score}
    </span>
  );
}
