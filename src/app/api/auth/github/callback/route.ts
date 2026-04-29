import { NextRequest, NextResponse } from "next/server";

/**
 * GitHub OAuth callback — exchanges code for access token.
 * This is for repo ingestion (separate from Clerk's GitHub login).
 * 
 * Flow:
 * 1. User clicks "Connect GitHub" → redirected to GitHub OAuth
 * 2. User authorizes → GitHub redirects here with ?code=...
 * 3. We exchange code for access token
 * 4. Store token, trigger ingestion, redirect to dashboard
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state"); // For CSRF protection

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard?error=github_denied", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?error=no_code", req.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("GitHub OAuth error:", tokenData);
      return NextResponse.redirect(
        new URL("/dashboard?error=token_exchange_failed", req.url)
      );
    }

    const accessToken = tokenData.access_token;

    // Store token — for now, redirect with token in URL (MVP only!)
    // In production: store in Clerk user metadata (encrypted)
    // or in Supabase with user_id
    return NextResponse.redirect(
      new URL(
        `/dashboard?github_token=${accessToken}&github_connected=true`,
        req.url
      )
    );
  } catch (e) {
    console.error("GitHub OAuth callback error:", e);
    return NextResponse.redirect(
      new URL("/dashboard?error=callback_failed", req.url)
    );
  }
}
