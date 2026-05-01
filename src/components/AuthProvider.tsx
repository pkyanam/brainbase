"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { useClerkAppearance } from "@/hooks/useClerkAppearance";

/**
 * Dev-mode tolerant Clerk wrapper.
 * In development without Clerk keys, renders children without auth.
 * In production, full Clerk auth is enforced.
 */
function ClerkWrapper({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey || publishableKey === "pk_test_***" || publishableKey.startsWith("***")) {
    return <>{children}</>;
  }

  return (
    <ClerkAppearanceProvider>
      {children}
    </ClerkAppearanceProvider>
  );
}

function ClerkAppearanceProvider({ children }: { children: ReactNode }) {
  const { appearance } = useClerkAppearance();

  return (
    <ClerkProvider
      appearance={appearance}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {children}
    </ClerkProvider>
  );
}

export default ClerkWrapper;
