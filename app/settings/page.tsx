import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import SettingsPanel from "@/components/settings/SettingsPanel";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

export default async function SettingsPage() {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/settings");

  const db = getServerClient();
  const [profileResult, blocksResult] = await Promise.all([
    db
      .from("user_profiles")
      .select("display_name, headline, is_visible, is_recruiter, company_name")
      .eq("user_id", user.id)
      .single(),
    db
      .from("experience_blocks")
      .select("block_id, title, embedded_text, date_range, helper_urls, source_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = {
    display_name: profileResult.data?.display_name ?? null,
    headline: profileResult.data?.headline ?? null,
    is_visible: profileResult.data?.is_visible ?? true,
    is_recruiter: profileResult.data?.is_recruiter ?? false,
    company_name: profileResult.data?.company_name ?? null,
  };

  const blocks = (blocksResult.data ?? []).map((b) => ({
    block_id: b.block_id,
    title: b.title,
    embedded_text: b.embedded_text,
    date_range: b.date_range ?? null,
    helper_urls: b.helper_urls ?? [],
    source_type: b.source_type,
  }));

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar userEmail={user.email ?? ""} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0 lg:hidden">
          <span className="text-sm font-semibold text-slate-700">Settings</span>
        </header>

        <SettingsPanel
          email={user.email ?? ""}
          profile={profile}
          blocks={blocks}
        />
      </div>
    </div>
  );
}
