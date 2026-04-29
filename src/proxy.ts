import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Skip auth in development
const isDev = process.env.NODE_ENV === "development";

// Only protect dashboard + ingestion API in production
const protectedPaths = ["/dashboard", "/api/ingest"];

export default clerkMiddleware(async (auth, req) => {
  if (isDev) return; // No auth in dev

  const path = req.nextUrl.pathname;
  const needsAuth = protectedPaths.some((p) => path.startsWith(p));

  if (needsAuth) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*|favicon\\.ico).*)",
    "/(api|trpc)(.*)",
  ],
};
