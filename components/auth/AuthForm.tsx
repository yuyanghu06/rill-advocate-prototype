"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getBrowserClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), is_recruiter: isRecruiter },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setConfirmSent(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  if (confirmSent) {
    return (
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Check your email</h2>
        <p className="text-sm text-slate-500">
          We sent a confirmation link to <strong>{email}</strong>.<br />
          Click it to activate your account and continue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); setFullName(""); }}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
              mode === m
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full name/Company Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Jane Smith"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="••••••••"
            minLength={8}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-400"
          />
        </div>

        {mode === "signup" && (
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isRecruiter}
              onChange={(e) => setIsRecruiter(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-brand-500"
            />
            <span className="text-sm text-slate-600">
              I&apos;m a recruiter or hiring manager
            </span>
          </label>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-sm py-2.5 rounded-xl transition-colors"
        >
          {loading
            ? "Please wait…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>
    </div>
  );
}
