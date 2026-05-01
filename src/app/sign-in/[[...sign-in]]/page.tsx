"use client";

import { SignIn } from "@clerk/nextjs";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useClerkAppearance } from "@/hooks/useClerkAppearance";

export default function SignInPage() {
  const { appearance } = useClerkAppearance();
  const hasClerk =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_***";

  if (!hasClerk) {
    return (
      <div className="min-h-screen flex flex-col bg-bb-bg-primary text-bb-text-primary">
        <Nav />
        <main className="flex-1 flex items-center justify-center px-5">
          <div className="text-center max-w-md mx-auto p-6 md:p-8 border border-bb-border rounded-xl bg-bb-bg-secondary">
            <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-bb-accent text-lg font-semibold">B</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight mb-2">Auth not configured</h1>
            <p className="text-sm text-bb-text-secondary mb-6 leading-relaxed">
              Clerk keys not found. Set{" "}
              <code className="text-bb-accent font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
              and <code className="text-bb-accent font-mono text-xs">CLERK_SECRET_KEY</code> in{" "}
              <code className="text-bb-text-primary font-mono text-xs">.env.local</code>.
            </p>
            <a
              href="/dashboard"
              className="inline-flex h-11 px-6 items-center justify-center rounded-md bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium text-sm transition-colors"
            >
              Continue to dashboard (dev mode)
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bb-bg-primary text-bb-text-primary">
      <Nav />
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-bb-accent text-lg font-semibold">B</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-bb-text-secondary mt-1">Sign in to your brain</p>
          </div>
          <SignIn fallbackRedirectUrl="/dashboard" appearance={appearance} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
