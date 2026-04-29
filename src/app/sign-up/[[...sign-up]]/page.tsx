"use client";

import { SignUp } from "@clerk/nextjs";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function SignUpPage() {
  const hasClerk =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_***";

  if (!hasClerk) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Nav />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-black">B</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Auth not configured</h1>
            <p className="text-sm text-neutral-400 mb-6">
              Set up Clerk to enable sign-up. See{" "}
              <code className="text-cyan-400">.env.local.example</code>
            </p>
            <a
              href="/dashboard"
              className="text-sm px-6 py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-all"
            >
              Continue to Dashboard (dev mode) →
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Nav />
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md mx-auto p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-600/20">
              <span className="text-white text-xl font-black">B</span>
            </div>
            <h1 className="text-2xl font-bold">Create your brain</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Give your AI agents a memory
            </p>
          </div>
          <SignUp
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-neutral-950 border border-neutral-800 rounded-2xl shadow-none",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-200 rounded-xl",
                formButtonPrimary:
                  "bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 rounded-xl",
                formFieldInput:
                  "bg-neutral-900 border-neutral-800 rounded-lg text-neutral-200",
                footerActionLink: "text-cyan-400 hover:text-emerald-400",
              },
            }}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
