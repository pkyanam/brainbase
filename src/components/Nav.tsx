"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";

import { useTheme } from "@/components/ThemeProvider";

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

  const links = [
    { href: "/demo", label: "Demo" },
    { href: "/docs", label: "Docs" },
    { href: "/pricing", label: "Pricing" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  const handleClose = () => setOpen(false);

  return (
    <>
      {/* Hidden checkbox — CSS toggle so mobile menu works even without JS */}
      <input
        type="checkbox"
        id="nav-toggle"
        className="peer sr-only"
        checked={open}
        onChange={(e) => setOpen(e.target.checked)}
      />

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

            {/* Hamburger — <label> targets hidden checkbox, works WITHOUT JavaScript */}
            <label
              htmlFor="nav-toggle"
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
            </label>
          </div>
        </div>
      </nav>

      {/* Mobile menu drawer — always in DOM, CSS peer-checked: drives visibility (works without JS) */}
      <div className="md:hidden hidden peer-checked:flex fixed inset-0 z-50 bg-bb-bg-primary flex-col">
        {/* Menu header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-bb-border shrink-0">
          <span className="text-[15px] font-semibold text-bb-text-primary">Menu</span>
          <label
            htmlFor="nav-toggle"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-bb-text-secondary hover:text-bb-text-primary hover:bg-bb-surface transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </label>
        </div>

        {/* Menu links */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={handleClose}
              className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors border-b border-bb-border last:border-0"
            >
              {l.label}
            </a>
          ))}
          <SignedIn>
            <a
              href="/settings"
              onClick={handleClose}
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
              onClick={handleClose}
              className="h-12 flex items-center px-3 text-base text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
            >
              Sign in
            </a>
          </SignedOut>
        </div>
      </div>
    </>
  );
}
