"use client";

import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

export default function Nav() {
  return (
    <nav className="px-6 py-4 flex items-center justify-between border-b border-neutral-900">
      <a href="/" className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        <span className="text-sm font-semibold tracking-tight">brainbase</span>
      </a>
      <div className="flex items-center gap-6 text-sm">
        <a href="/docs" className="text-neutral-400 hover:text-neutral-200 transition-colors">Docs</a>
        <a href="/pricing" className="text-neutral-400 hover:text-neutral-200 transition-colors">Pricing</a>
        <a href="/dashboard" className="text-neutral-400 hover:text-neutral-200 transition-colors">Dashboard</a>
        <SignedIn>
          <div className="flex items-center gap-3">
            <a href="/settings" className="text-neutral-400 hover:text-neutral-200 transition-colors">Settings</a>
            <UserButton />
          </div>
        </SignedIn>
        <SignedOut>
          <a href="/sign-in" className="text-neutral-400 hover:text-neutral-200 transition-colors">Sign in</a>
          <a href="/sign-up" className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">Get started</a>
        </SignedOut>
      </div>
    </nav>
  );
}
