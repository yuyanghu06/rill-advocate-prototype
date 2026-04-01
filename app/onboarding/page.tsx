import { redirect } from "next/navigation";
import ChatWindow from "@/components/chat/ChatWindow";
import ExperienceBlockList from "@/components/onboarding/ExperienceBlockList";
import SkillsList from "@/components/onboarding/SkillsList";
import Sidebar from "@/components/dashboard/Sidebar";
import { getSessionUser } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

export default async function OnboardingPage() {
  const user = await getSessionUser();

  if (!user) redirect("/auth?next=/onboarding");

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
        {/* Page header */}
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0 lg:hidden">
          <span className="text-sm font-semibold text-slate-700">Onboarding</span>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Sign out
            </button>
          </form>
        </header>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden px-4 py-4 gap-4">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <ChatWindow userId={user.id} is_recruiter={is_recruiter} />
          </div>

          <aside className="hidden lg:flex w-72 flex-col gap-3 overflow-y-auto min-h-0">
            {/* User card + experiences */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-600 font-bold text-sm">
                    {user.email?.[0].toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {user.email}
                  </p>
                  <p className="text-xs text-slate-400">In progress</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                {is_recruiter ? "Job Openings" : "Experiences"}
              </p>
              <ExperienceBlockList userId={user.id} is_recruiter={is_recruiter} />
            </div>

            <SkillsList userId={user.id} is_recruiter={is_recruiter} />
          </aside>
        </div>
      </div>
    </div>
  );
}
