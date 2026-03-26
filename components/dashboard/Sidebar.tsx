"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BugReportModal from "@/components/dashboard/BugReportModal";

const NAV_ITEMS = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/advocate", label: "Advocate" },
  { href: "/discover", label: "Discover" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [bugModalOpen, setBugModalOpen] = useState(false);

  useEffect(() => {
    if (pendingHref && pathname.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  return (
    <aside className="hidden lg:flex w-56 flex-col bg-white border-r border-slate-100 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-100">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          rill<span className="text-brand-500">.</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = (pendingHref ?? pathname).startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setPendingHref(href)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-slate-100 space-y-2">
        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
        <div className="flex items-center justify-between">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Sign out
            </button>
          </form>
          <button
            onClick={() => setBugModalOpen(true)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
            title="Report a bug"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Bug
          </button>
        </div>
      </div>

      {bugModalOpen && <BugReportModal onClose={() => setBugModalOpen(false)} />}
    </aside>
  );
}
