import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

const routes = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "/docs", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
];

export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const now = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
