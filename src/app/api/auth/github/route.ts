import { NextResponse } from "next/server";

/**
 * Initiate GitHub OAuth flow for repo ingestion.
 * GET /api/auth/github → redirects to GitHub authorization page.
 */

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174"}/api/auth/github/callback`;
  const scope = "read:user,public_repo";
  const state = Math.random().toString(36).substring(7); // CSRF protection

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId || "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");

  return NextResponse.redirect(url.toString());
}
