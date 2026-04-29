"use client";

import { useUser, UserButton as ClerkUserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("***");

export function SignedIn({ children }: { children: ReactNode }) {
  if (!hasClerk) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSignedIn } = useUser();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  if (!hasClerk) return <>{children}</>;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSignedIn } = useUser();
  return !isSignedIn ? <>{children}</> : null;
}

export function UserButton(props: React.ComponentProps<typeof ClerkUserButton>) {
  if (!hasClerk) return null;
  return <ClerkUserButton {...props} />;
}
