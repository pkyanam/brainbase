import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Skip auth in development
const isDev = process.env.NODE_ENV === "development";

// Only protect dashboard + ingestion API in production
const protectedPaths = ["/dashboard", "/api/ingest"];

// Public API routes that use Bearer token auth (not Clerk sessions)
const publicApiPaths = ["/api/mcp", "/api/keys", "/api/provision"];

export default clerkMiddleware(async (auth, req) => {
  if (isDev) return; // No auth in dev

  const path = req.nextUrl.pathname;

  // MCP + API key endpoints use Bearer token auth — skip Clerk entirely
  if (publicApiPaths.some((p) => path.startsWith(p))) return;

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
