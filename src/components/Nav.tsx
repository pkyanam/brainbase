"use client";

import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

export default function Nav() {
  return (
    <nav className="px-6 py-4 flex items-center justify-between border-b border-bb-border">
      <a href="/" className="flex items-center gap-3">
        <Image
          src="/brainbaseLogo.png"
          alt="Brainbase"
          width={28}
          height={28}
          className="rounded-md"
          priority
        />
        <span className="text-sm font-semibold tracking-tight text-bb-text-primary">brainbase</span>
      </a>
      <div className="flex items-center gap-6 text-sm">
        <a href="/docs" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Docs</a>
        <a href="/pricing" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Pricing</a>
        <a href="/dashboard" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Dashboard</a>
        <SignedIn>
          <div className="flex items-center gap-3">
            <a href="/settings" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Settings</a>
            <UserButton />
          </div>
        </SignedIn>
        <SignedOut>
          <a href="/sign-in" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Sign in</a>
          <a
            href="/sign-up"
            className="px-4 py-2 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary text-sm font-medium rounded-lg transition-colors"
          >
            Get started
          </a>
        </SignedOut>
      </div>
    </nav>
  );
}
