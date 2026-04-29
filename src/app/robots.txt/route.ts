import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const robots = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /settings
Disallow: /api/
Disallow: /b/*/api/
Disallow: /b/*/mcp

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new NextResponse(robots, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
