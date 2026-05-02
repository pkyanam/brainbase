"use client";

import { ReactNode } from "react";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Convex client provider. Uses Clerk auth when available, falls back to no-auth.
 * Gracefully skips if NEXT_PUBLIC_CONVEX_URL is not configured.
 */
export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) return <>{children}</>;

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasClerk = publishableKey && !String(publishableKey).startsWith("***") && publishableKey !== "pk_test_***";

  if (hasClerk) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
