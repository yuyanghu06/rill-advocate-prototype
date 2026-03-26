import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import AdvocateChatWindow from "@/components/chat/AdvocateChatWindow";
import ProfilePopup from "@/components/profile/ProfilePopup";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

export default async function AdvocatePage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const supabase = await getAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/advocate");

  const { with: targetUserId } = await searchParams;

  const db = getServerClient();

  // Always fetch the logged-in user's own display_name for the self-mode greeting.
  // Also fetch the target candidate's name when in recruiter mode.
  const isRecruiterMode = !!targetUserId && targetUserId !== user.id;

  const candidateProfile = isRecruiterMode
    ? await db.from("user_profiles").select("display_name").eq("user_id", targetUserId).single()
    : null;

  const candidateName = candidateProfile?.data?.display_name ?? undefined;

  const pageTitle = candidateName ? `Advocate · ${candidateName}` : "Advocate";

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar userEmail={user.email ?? ""} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
          <span className="text-sm font-semibold text-slate-700">{pageTitle}</span>
          {isRecruiterMode && targetUserId && (
            <div className="flex items-center gap-3">
              <ProfilePopup userId={targetUserId} candidateName={candidateName} />
              <a
                href="/advocate"
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Back to my profile
              </a>
            </div>
          )}
        </header>

        <div className="flex flex-1 overflow-hidden px-4 py-4">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <AdvocateChatWindow
              targetUserId={targetUserId}
              candidateName={candidateName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
