import { NextResponse } from "next/server";
import { getHealth } from "@/lib/supabase/health";
import { getBaseUrl } from "@/lib/url";
import { requireOwner } from "@/lib/auth-guard";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const { username } = await params;
  const baseUrl = getBaseUrl(req);

  try {
    const stats = await getHealth(auth.brainId);

    const llmsTxt = `# Brainbase — ${username}'s Brain
> AI agent-accessible knowledge graph — your agents finally know what you know.

## Brain at a Glance
- **Total pages:** ${stats.page_count}
- **People:** ${stats.pages_by_type?.person || 0}
- **Projects:** ${stats.pages_by_type?.project || 0}
- **Companies:** ${stats.pages_by_type?.company || 0}
- **Concepts:** ${stats.pages_by_type?.concept || 0}
- **Ideas:** ${stats.pages_by_type?.idea || 0}
- **Total links:** ${stats.link_count}
- **Brain score:** ${stats.brain_score}/100
- **Engine:** GBrain on Supabase

## How to Use This Brain
This is a structured knowledge graph you can query programmatically.
Every page has typed links to related entities. Your job is to retrieve
relevant pages and synthesize answers from the connected context.

### Quick Commands
- Search: GET /b/${username}/api/search?q=your+query
- Status: GET /b/${username}/api/status.json
- Full MCP: POST /b/${username}/mcp (JSON-RPC, 16 tools)

### MCP Configuration
Add this to your agent's MCP config to get persistent memory:
\`\`\`json
{
  "mcpServers": {
    "brainbase": {
      "url": "${baseUrl}/b/${username}/mcp",
      "transport": "http"
    }
  }
}
\`\`\`

### Available MCP Tools
- get_health — brain health dashboard
- get_stats — full statistics
- list_pages — all pages with metadata
- get_page — full page content by slug
- query — hybrid search across all content
- search — keyword search
- get_links — outgoing links from a page
- get_graph — full knowledge graph (nodes + edges)

### Page Types & Slug Convention
Pages follow \`type/slug\` convention:
- people/ — individuals
- companies/ — organizations
- projects/ — software/products
- concepts/ — abstract ideas
- ideas/ — tweets, thoughts, insights
- sources/ — external references
- meetings/ — calendar events

### When Answering Questions
1. Search for relevant pages using query or search
2. Retrieve full content of top matches with get_page
3. Follow links to related entities using get_links
4. Synthesize from the connected knowledge
5. Always cite page slugs as sources
`;

    return new NextResponse(llmsTxt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[brainbase] llms.txt error:", err);
    return NextResponse.json({ error: "Failed to generate llms.txt" }, { status: 500 });
  }
}
