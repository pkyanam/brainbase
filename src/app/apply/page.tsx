"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function ApplyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      team_size: (form.elements.namedItem("team_size") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try again or email us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full h-11 px-3.5 bg-bb-bg-secondary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors";
  const labelClass = "block text-xs font-medium text-bb-text-secondary mb-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary flex flex-col">
      <Nav />

      <main className="flex-1">
        <div className="max-w-lg mx-auto px-5 md:px-6 pt-12 md:pt-16 pb-20 md:pb-24">
          {submitted ? (
            <div className="text-center pt-8">
              <div className="w-12 h-12 rounded-full bg-bb-accent-glow border border-bb-accent/40 flex items-center justify-center mx-auto mb-5">
                <svg className="w-5 h-5 text-bb-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l3 3 7-7" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight mb-3">Application received</h1>
              <p className="text-bb-text-secondary leading-relaxed">
                Thanks for your interest. We&apos;ll review your application and reach out
                within a few days if it&apos;s a good fit.
              </p>
              <a
                href="/"
                className="inline-flex h-11 px-6 items-center justify-center mt-8 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-md transition-colors"
              >
                Back to home
              </a>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <p className="text-xs uppercase tracking-widest text-bb-accent font-medium mb-3">Early access</p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                  Apply to build with Brainbase
                </h1>
                <p className="text-bb-text-secondary text-sm md:text-base leading-relaxed">
                  We&apos;re working closely with a small group of teams to refine Brainbase.
                  Tell us about yours.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className={labelClass}>
                    Name <span className="text-bb-danger">*</span>
                  </label>
                  <input id="name" name="name" type="text" required placeholder="Your name" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email <span className="text-bb-danger">*</span>
                  </label>
                  <input id="email" name="email" type="email" required placeholder="you@company.com" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="company" className={labelClass}>Company</label>
                  <input id="company" name="company" type="text" placeholder="Company name" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="team_size" className={labelClass}>Team size</label>
                  <select id="team_size" name="team_size" className={inputClass}>
                    <option value="">Select…</option>
                    <option value="1-5">1 to 5</option>
                    <option value="6-20">6 to 20</option>
                    <option value="21-50">21 to 50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className={labelClass}>
                    What problem are you trying to solve?
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="e.g. Our AI agents keep making refund decisions inconsistently because the rules live in Slack threads..."
                    className="w-full px-3.5 py-3 bg-bb-bg-secondary border border-bb-border rounded-md text-sm text-bb-text-primary placeholder:text-bb-text-muted outline-none focus:border-bb-accent transition-colors resize-none"
                  />
                </div>

                {error && (
                  <div className="px-4 py-3 bg-bb-surface border border-bb-danger/40 rounded-md text-sm text-bb-danger">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 px-6 bg-bb-accent hover:bg-bb-accent-strong disabled:opacity-50 disabled:cursor-not-allowed text-bb-bg-primary font-medium rounded-md transition-colors"
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
