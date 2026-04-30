"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

export default function Nav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const links = [
    { href: "/demo", label: "Demo" },
    { href: "/docs", label: "Docs" },
    { href: "/pricing", label: "Pricing" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 bg-bb-bg-primary/85 backdrop-blur-sm border-b border-bb-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Logo + wordmark */}
          <a href="/" className="flex items-center gap-2 shrink-0 group">
            <Image
              src="/brainbaseLogo.png"
              alt=""
              width={22}
              height={22}
              className="rounded"
              priority
            />
            <span className="text-[15px] font-semibold tracking-tight text-bb-text-primary group-hover:text-bb-accent transition-colors">
              brainbase
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 text-sm">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
              >
                {l.label}
              </a>
            ))}
            <SignedIn>
              <a
                href="/settings"
                className="px-3 py-2 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
              >
                Settings
              </a>
            </SignedIn>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <SignedIn>
              <div className="hidden md:block">
                <UserButton />
              </div>
            </SignedIn>
            <SignedOut>
              <a
                href="/sign-in"
                className="hidden sm:inline-flex items-center h-9 px-3 text-sm text-bb-text-secondary hover:text-bb-text-primary transition-colors"
              >
                Sign in
              </a>
              {/* Hide "Get started" when mobile menu is open */}
              {!open && (
                <a
                  href="/sign-up"
                  className="inline-flex items-center h-9 px-3.5 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-md transition-colors"
                >
                  Get started
                </a>
              )}
            </SignedOut>

            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu — rendered OUTSIDE nav to avoid Safari stacking context quirks */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-bb-bg-primary flex flex-col">
          {/* Menu header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-bb-border shrink-0">
            <span className="text-[15px] font-semibold text-bb-text-primary">Menu</span>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center w-11 h-11 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu links */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors border-b border-bb-border last:border-0"
              >
                {l.label}
              </a>
            ))}
            <SignedIn>
              <a
                href="/settings"
                onClick={() => setOpen(false)}
                className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors border-b border-bb-border"
              >
                Settings
              </a>
              <div className="px-3 pt-4">
                <UserButton />
              </div>
            </SignedIn>
            <SignedOut>
              <a
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
              >
                Sign in
              </a>
            </SignedOut>
          </div>
        </div>
      )}
    </>
  );
}
