import { NextResponse } from "next/server";
import { getStats } from "@/lib/supabase/write";
import { requireOwner } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const stats = await getStats(auth.brainId);

  const llmsTxt = `# Brainbase
> AI agent-accessible knowledge graph — your company's brain.

## About
Brainbase turns your scattered digital artifacts into a structured knowledge graph
that any AI agent can query via standard protocols. Connect your tools. Build your brain.
Your agents finally know what you know.

## Quick Facts
- **Pages:** ${stats.page_count}
- **Links:** ${stats.link_count}
- **People:** ${stats.pages_by_type?.person || 0}
- **Projects:** ${stats.pages_by_type?.project || 0}
- **Companies:** ${stats.pages_by_type?.company || 0}
- **Concepts:** ${stats.pages_by_type?.concept || 0}
- **Engine:** GBrain (Garry Tan)
- **Frontend:** Brainbase v0.2 — Next.js + Three.js

## API Endpoints
- **Health:** /api/brain/health
- **Search:** /api/brain/search?q={query}
- **Pages:** /api/brain/page/{slug}
- **Graph:** /api/brain/graph
- **MCP Manifest:** /api/mcp

## How agents use Brainbase
1. Read this file to understand the brain's structure.
2. Use /api/brain/search to find relevant pages.
3. Use /api/brain/page/{slug} to retrieve full page content.
4. Use /api/mcp to discover available MCP tools.

## Schema
Pages have: slug, title, type (person|company|project|concept|idea|source|meeting), content (markdown), frontmatter, created_at, updated_at.
Links have: from_slug, to_slug, link_type (built|works_at|mentions|invested_in|references|implements|created_by).

## Authentication
API key required for all brain data endpoints. Multi-tenant: every user gets their own isolated brain.

## Support
Built by Preetham Kyanam. Part of the pkstack ecosystem.
`;

  return new NextResponse(llmsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
