import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import DiscoverSearch from "@/components/discover/DiscoverSearch";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

export default async function DiscoverPage() {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/discover");

  const db = getServerClient();
  const { data: profile } = await db
    .from("user_profiles")
    .select("is_recruiter")
    .eq("user_id", user.id)
    .single();
  const is_recruiter = profile?.is_recruiter ?? false;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar userEmail={user.email ?? ""} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0 lg:hidden">
          <span className="text-sm font-semibold text-slate-700">Discover</span>
        </header>

        <DiscoverSearch is_recruiter={is_recruiter} />
      </div>
    </div>
  );
}
