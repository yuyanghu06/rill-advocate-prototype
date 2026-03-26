import { notFound } from "next/navigation";
import Link from "next/link";
import ExperienceBlock from "@/components/profile/ExperienceBlock";
import RankingBadge from "@/components/profile/RankingBadge";
import SkillsList from "@/components/onboarding/SkillsList";

type ProfileData = {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  ranking_score: number;
  blocks: {
    block_id: string;
    title: string;
    overview: string;
    date_range?: string;
    source_type: string;
    source_url: string;
    helper_urls: string[];
  }[];
};

async function getProfile(userId: string): Promise<ProfileData | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/profile/${userId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await getProfile(userId);

  if (!profile || profile.blocks.length === 0) notFound();

  const name = profile.display_name ?? `Candidate ${userId.slice(0, 8)}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            rill<span className="text-brand-500">.</span>
          </Link>
          <Link
            href="/discover"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to search
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 font-bold text-xl">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{name}</h1>
            {profile.headline && (
              <p className="text-sm text-slate-600 mt-0.5 truncate">{profile.headline}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {profile.blocks.length} experience block
              {profile.blocks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <RankingBadge score={profile.ranking_score} />
        </div>

        {/* Skills */}
        <SkillsList userId={userId} />

        {/* Experience blocks */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Experience
          </h2>
          <div className="space-y-4">
            {profile.blocks.map((block) => (
              <ExperienceBlock
                key={block.block_id}
                title={block.title}
                overview={block.overview}
                date_range={block.date_range}
                source_type={block.source_type}
                helper_urls={block.helper_urls}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
