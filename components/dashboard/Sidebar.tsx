"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/converse", label: "Converse" },
  { href: "/discover", label: "Discover" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

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
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
      <div className="px-4 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-400 truncate mb-2">{userEmail}</p>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
