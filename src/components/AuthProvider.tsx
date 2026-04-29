"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * Dev-mode tolerant Clerk wrapper.
 * In development without Clerk keys, renders children without auth.
 * In production, full Clerk auth is enforced.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // In dev without Clerk keys, skip auth
  if (!publishableKey || publishableKey === "pk_test_***" || publishableKey.startsWith("***")) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProvider>
  );
}
