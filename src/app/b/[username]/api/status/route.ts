import { NextResponse } from "next/server";
import { getHealth } from "@/lib/supabase/health";
import { getGraphData } from "@/lib/supabase/graph";
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
    const graph = await getGraphData(auth.brainId);

    const topConnected = [...graph.nodes]
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, 5)
      .map((n) => ({
        slug: n.id,
        title: n.label,
        type: n.type,
        linkCount: n.linkCount,
      }));

    return NextResponse.json({
      brain: `${username}'s brain`,
      url: `${baseUrl}/b/${username}`,
      version: "0.3.0",
      engine: "GBrain (Supabase)",
      stats: {
        page_count: stats.page_count,
        pages_by_type: stats.pages_by_type,
        link_count: stats.link_count,
        brain_score: stats.brain_score,
      },
      top_connected: topConnected,
      endpoints: {
        llms_txt: `/b/${username}/llms.txt`,
        status: `/b/${username}/api/status.json`,
        search: `/b/${username}/api/search?q=`,
        mcp: `/b/${username}/mcp`,
      },
      agent_config: {
        mcpServers: {
          brainbase: {
            url: `${baseUrl}/b/${username}/mcp`,
            transport: "http",
          },
        },
      },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[brainbase] Status error:", err);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
