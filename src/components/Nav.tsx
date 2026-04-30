"use client";

import { useState } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="px-4 sm:px-6 py-4 border-b border-bb-border">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 shrink-0">
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

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm">
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

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-bb-text-muted hover:text-bb-text-primary transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-4 pt-4 border-t border-bb-border flex flex-col gap-3 text-sm">
          <a href="/docs" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Docs</a>
          <a href="/pricing" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Pricing</a>
          <a href="/dashboard" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Dashboard</a>
          <SignedIn>
            <a href="/settings" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Settings</a>
            <div className="pt-1">
              <UserButton />
            </div>
          </SignedIn>
          <SignedOut>
            <a href="/sign-in" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Sign in</a>
            <a
              href="/sign-up"
              className="px-4 py-2 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary text-sm font-medium rounded-lg transition-colors text-center"
            >
              Get started
            </a>
          </SignedOut>
        </div>
      )}
    </nav>
  );
}
