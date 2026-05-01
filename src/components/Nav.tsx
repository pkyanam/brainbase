"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";
import { useTheme } from "@/components/ThemeProvider";

const links = [
  { href: "/demo", label: "Demo" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/graph", label: "Graph" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { resolved, toggle } = useTheme();

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

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
            <button
              onClick={toggle}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {resolved === "dark" ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
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
              <a
                href="/sign-up"
                className={`inline-flex items-center h-9 px-3.5 bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary text-sm font-medium rounded-md transition-colors ${open ? "hidden" : ""}`}
              >
                Get started
              </a>
            </SignedOut>

            {/* Hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors cursor-pointer"
              aria-label={open ? "Close menu" : "Open menu"}
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

      {/* Mobile menu drawer — proper React-driven, conditionally rendered */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-black/60"
          />
          {/* Drawer */}
          <div className="relative ml-auto w-[85vw] max-w-sm h-full bg-bb-bg-primary border-l border-bb-border flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between h-14 px-4 border-b border-bb-border shrink-0">
              <span className="text-[15px] font-semibold text-bb-text-primary">Menu</span>
              <button
                onClick={close}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors border-b border-bb-border last:border-0"
                >
                  {l.label}
                </a>
              ))}
              <SignedIn>
                <a
                  href="/settings"
                  onClick={close}
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
                  onClick={close}
                  className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
                >
                  Sign in
                </a>
              </SignedOut>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
