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

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      <main className="max-w-lg mx-auto px-6 pt-16 pb-24">
        {submitted ? (
          <div className="text-center pt-12">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-400 text-xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold mb-3">Application received</h1>
            <p className="text-bb-text-secondary leading-relaxed">
              Thanks for your interest. We&apos;ll review your application and reach out
              within a few days if it&apos;s a good fit.
            </p>
            <a
              href="/"
              className="inline-block mt-8 px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors"
            >
              Back to home
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Apply for early access</h1>
            <p className="text-bb-text-secondary mb-8">
              We&apos;re working closely with a small group of teams to refine Brainbase.
              Tell us about yours.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bb-accent/50"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bb-accent/50"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium mb-1.5">
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="w-full px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bb-accent/50"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label htmlFor="team_size" className="block text-sm font-medium mb-1.5">
                  Team size
                </label>
                <select
                  id="team_size"
                  name="team_size"
                  className="w-full px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bb-accent/50"
                >
                  <option value="">Select...</option>
                  <option value="1-5">1–5</option>
                  <option value="6-20">6–20</option>
                  <option value="21-50">21–50</option>
                  <option value="50+">50+</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-1.5">
                  What problem are you trying to solve?
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  className="w-full px-4 py-2.5 bg-bb-bg-secondary border border-bb-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bb-accent/50 resize-none"
                  placeholder="e.g. Our AI agents keep making refund decisions inconsistently because the rules live in Slack threads..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim disabled:opacity-50 text-bb-bg-primary font-medium rounded-xl transition-colors"
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            </form>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
