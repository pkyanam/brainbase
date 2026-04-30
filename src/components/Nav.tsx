"use client";

import { useState } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="px-4 sm:px-6 py-4 border-b border-bb-border">
      <div className="flex items-center justify-between gap-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 shrink-0 min-w-0">
          <Image
            src="/brainbaseLogo.png"
            alt=""
            width={28}
            height={28}
            className="rounded-md shrink-0"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-bb-text-primary truncate">
            brainbase
          </span>
        </a>

        {/* Right side: CTA (always visible) + desktop links + hamburger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop text links */}
          <div className="hidden md:flex items-center gap-6 text-sm mr-2">
            <a href="/docs" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Docs</a>
            <a href="/pricing" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Pricing</a>
            <a href="/dashboard" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Dashboard</a>
            <SignedIn>
              <a href="/settings" className="text-bb-text-muted hover:text-bb-text-secondary transition-colors">Settings</a>
            </SignedIn>
          </div>

          {/* Auth / CTA — always visible, compact on mobile */}
          <SignedIn>
            <div className="hidden md:block">
              <UserButton />
            </div>
          </SignedIn>
          <SignedOut>
            <a
              href="/sign-up"
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">Start</span>
              <span className="hidden sm:inline">Get started</span>
            </a>
          </SignedOut>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 -mr-2 text-bb-text-muted hover:text-bb-text-primary transition-colors"
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
          </SignedOut>
        </div>
      )}
    </nav>
  );
}
