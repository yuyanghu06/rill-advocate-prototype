import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import ConverseChatWindow from "@/components/chat/ConverseChatWindow";
import { getAuthServerClient } from "@/lib/supabase.server";

export default async function ConversePage() {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/converse");

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar userEmail={user.email ?? ""} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0 lg:hidden">
          <span className="text-sm font-semibold text-slate-700">Converse</span>
        </header>

        <div className="flex flex-1 overflow-hidden px-4 py-4">
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <ConverseChatWindow />
          </div>
        </div>
      </div>
    </div>
  );
}
