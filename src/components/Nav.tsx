"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { SignedIn, SignedOut, UserButton } from "@/components/SafeClerk";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, X, List } from "@phosphor-icons/react";

const links = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
];

const authLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/graph", label: "Graph" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { resolved, toggle } = useTheme();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <nav className="sticky top-0 z-40 bg-bb-bg-primary/80 backdrop-blur-md border-b border-bb-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/brainbaseLogo.png"
              alt=""
              width={24}
              height={24}
              className="rounded w-6 h-6"
              priority
            />
            <span className="text-base font-semibold tracking-tight text-bb-text-primary">
              brainbase
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="px-3 py-2 text-sm text-bb-text-secondary hover:text-bb-text-primary transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <SignedIn>
                {authLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="px-3 py-2 text-sm text-bb-text-secondary hover:text-bb-text-primary transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </SignedIn>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggle}
                className="w-9 h-9 flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary hover:bg-bb-surface transition-colors"
                aria-label="Toggle theme"
              >
                {resolved === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <SignedIn>
                <UserButton />
              </SignedIn>
              
              <SignedOut>
                <a
                  href="/sign-in"
                  className="text-sm text-bb-text-secondary hover:text-bb-text-primary transition-colors"
                >
                  Sign in
                </a>
                <a
                  href="/sign-up"
                  className="h-9 px-4 inline-flex items-center justify-center text-sm font-medium bg-bb-text-primary text-bb-bg-primary rounded-md hover:opacity-90 transition-opacity"
                >
                  Get started
                </a>
              </SignedOut>
            </div>
          </div>

          {/* Mobile controls */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggle}
              className="w-10 h-10 flex items-center justify-center rounded-md text-bb-text-muted hover:text-bb-text-primary transition-colors"
              aria-label="Toggle theme"
            >
              {resolved === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setOpen(!open)}
              className="w-10 h-10 flex items-center justify-center rounded-md text-bb-text-secondary hover:text-bb-text-primary transition-colors"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative ml-auto w-[80vw] max-w-sm h-full bg-bb-bg-primary border-l border-bb-border flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between h-16 px-6 border-b border-bb-border">
              <span className="font-semibold text-bb-text-primary">Menu</span>
              <button
                onClick={close}
                className="w-10 h-10 flex items-center justify-center rounded-md text-bb-text-secondary hover:text-bb-text-primary transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="h-12 flex items-center px-4 text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
                >
                  {l.label}
                </a>
              ))}
              <SignedIn>
                {authLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={close}
                    className="h-12 flex items-center px-4 text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href="/settings"
                  onClick={close}
                  className="h-12 flex items-center px-4 text-bb-text-primary rounded-md hover:bg-bb-surface transition-colors"
                >
                  Settings
                </a>
                <div className="px-4 pt-4">
                  <UserButton />
                </div>
              </SignedIn>
              <SignedOut>
                <div className="pt-4 px-4 space-y-3">
                  <a
                    href="/sign-in"
                    onClick={close}
                    className="block w-full h-11 flex items-center justify-center text-bb-text-primary border border-bb-border rounded-md hover:bg-bb-surface transition-colors"
                  >
                    Sign in
                  </a>
                  <a
                    href="/sign-up"
                    onClick={close}
                    className="block w-full h-11 flex items-center justify-center font-medium bg-bb-text-primary text-bb-bg-primary rounded-md"
                  >
                    Get started
                  </a>
                </div>
              </SignedOut>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
