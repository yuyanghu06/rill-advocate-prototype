import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Share your sources",
    description:
      "Drop in your resume, LinkedIn, or GitHub. Advocate does the reading.",
  },
  {
    number: "02",
    title: "We build your profile",
    description:
      "Advocate extracts every job, project, and contribution into structured experience blocks.",
  },
  {
    number: "03",
    title: "Get discovered",
    description:
      "Recruiters search by skill, stack, and project type. Your ranked profile surfaces at the top.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight text-slate-900">
          rill<span className="text-brand-500">.</span>
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/recruiter"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            For recruiters
          </Link>
          <Link
            href="/auth"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="text-sm bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
          Now in early access
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight tracking-tight mb-6">
          Your work, finally{" "}
          <span className="text-brand-500">spoken for.</span>
        </h1>

        <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Advocate reads your resume, LinkedIn, and GitHub — then builds a
          verified, recruiter-ready profile in minutes. No forms. Just
          conversation.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-xl transition-colors text-base shadow-sm"
          >
            Build my profile →
          </Link>
          <Link
            href="/recruiter"
            className="w-full sm:w-auto border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium px-6 py-3 rounded-xl transition-colors text-base"
          >
            Search talent
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="bg-white rounded-2xl p-6 shadow-sm">
                <span className="text-xs font-bold text-brand-500 tracking-widest uppercase">
                  {step.number}
                </span>
                <h3 className="text-lg font-semibold text-slate-900 mt-2 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          Ready to let your work speak?
        </h2>
        <p className="text-slate-500 mb-8">
          Takes about 5 minutes. Advocate handles the rest.
        </p>
        <Link
          href="/onboarding"
          className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-sm"
        >
          Start for free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Rill. All rights reserved.
      </footer>
    </div>
  );
}
