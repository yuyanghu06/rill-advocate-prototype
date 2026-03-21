import Link from "next/link";
import ChatWindow from "@/components/chat/ChatWindow";

export default function OnboardingPage() {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 flex-shrink-0">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          rill<span className="text-brand-500">.</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Progress steps */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            {["Welcome", "Sources", "Enrichment", "Review"].map(
              (step, idx) => (
                <span key={step} className="flex items-center gap-1">
                  {idx > 0 && (
                    <span className="w-4 h-px bg-slate-200 inline-block" />
                  )}
                  <span
                    className={
                      idx === 0
                        ? "text-brand-500 font-medium"
                        : "text-slate-400"
                    }
                  >
                    {step}
                  </span>
                </span>
              )
            )}
          </div>

          <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Save & exit
          </button>
        </div>
      </header>

      {/* Main area — two-pane on large screens */}
      <div className="flex flex-1 overflow-hidden max-w-6xl w-full mx-auto px-4 py-4 gap-4">
        {/* Chat */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <ChatWindow />
        </div>

        {/* Sidebar — profile preview */}
        <aside className="hidden lg:flex w-72 flex-col gap-3">
          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-brand-600 font-bold text-sm">?</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Your profile
                </p>
                <p className="text-xs text-slate-400">In progress</p>
              </div>
            </div>

            {/* Placeholder blocks */}
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center px-3"
                >
                  <span className="text-xs text-slate-400">
                    Experience block {i}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tips card */}
          <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
            <p className="text-xs font-semibold text-brand-600 mb-2">
              Tips from Advocate
            </p>
            <ul className="text-xs text-brand-700 space-y-1.5 leading-relaxed">
              <li>• Share your resume first for the best results</li>
              <li>• Links to projects boost your ranking</li>
              <li>• You can always edit blocks later</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
