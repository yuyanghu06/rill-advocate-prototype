import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { getAuthServerClient } from "@/lib/supabase.server";

export default async function DiscoverPage() {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/discover");

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar userEmail={user.email ?? ""} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0 lg:hidden">
          <span className="text-sm font-semibold text-slate-700">Discover</span>
        </header>

        <div className="flex flex-1 items-center justify-center px-4">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-slate-700">Discover</p>
            <p className="text-sm text-slate-400">Coming soon — browse and connect with opportunities.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
