import { Suspense } from "react";
import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold tracking-tight text-slate-900">
            rill<span className="text-brand-500">.</span>
          </Link>
          <p className="text-sm text-slate-500 mt-1">
            Build your profile. Get discovered.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <Suspense>
            <AuthForm />
          </Suspense>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          By continuing you agree to our{" "}
          <span className="underline cursor-pointer">Terms</span> and{" "}
          <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
