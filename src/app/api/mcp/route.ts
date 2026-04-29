import { NextRequest, NextResponse } from "next/server";
import { searchBrain } from "@/lib/supabase/search";
import { getPage, getPageLinks, getTimeline } from "@/lib/supabase/pages";
import { getHealth } from "@/lib/supabase/health";
import { getGraphData } from "@/lib/supabase/graph";
import {
  putPage, deletePage, addLink, removeLink, addTimelineEntry,
  listPages, traverseGraph, getStats,
} from "@/lib/supabase/write";
import { validateApiKey } from "@/lib/api-keys";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

const tools = [
  { name: "search", description: "Search brain pages by keyword", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "query", description: "Natural language query of the brain", inputSchema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] } },
  { name: "get_page", description: "Get a brain page by slug", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "get_links", description: "Get incoming and outgoing links for a page", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "get_backlinks", description: "Get pages that link to a given page", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "get_timeline", description: "Get timeline entries for a page", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "get_health", description: "Get brain statistics and health score", inputSchema: { type: "object", properties: {} } },
  { name: "get_stats", description: "Get detailed brain statistics", inputSchema: { type: "object", properties: {} } },
  { name: "get_graph", description: "Get full graph data (nodes + edges)", inputSchema: { type: "object", properties: {} } },
  { name: "list_pages", description: "List all brain pages with metadata", inputSchema: { type: "object", properties: { type: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } } },
  { name: "traverse_graph", description: "Traverse the knowledge graph from a starting page", inputSchema: { type: "object", properties: { slug: { type: "string" }, depth: { type: "number" }, direction: { type: "string", enum: ["out", "in", "both"] } }, required: ["slug"] } },
  { name: "put_page", description: "Create or update a brain page", inputSchema: { type: "object", properties: { slug: { type: "string" }, title: { type: "string" }, type: { type: "string" }, content: { type: "string" }, frontmatter: { type: "object" } }, required: ["slug", "title"] } },
  { name: "delete_page", description: "Delete a brain page by slug", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "add_link", description: "Create a typed link between two pages", inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, link_type: { type: "string" } }, required: ["from", "to"] } },
  { name: "remove_link", description: "Remove a link between two pages", inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] } },
  { name: "add_timeline_entry", description: "Add a timeline event to a page", inputSchema: { type: "object", properties: { slug: { type: "string" }, date: { type: "string" }, summary: { type: "string" }, detail: { type: "string" }, source: { type: "string" } }, required: ["slug", "date", "summary"] } },
];

async function dispatch(brainId: string, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  switch (method) {
    case "search": {
      const q = params.query as string;
      if (!q) throw new Error("Missing 'query' parameter");
      return await searchBrain(brainId, q);
    }
    case "get_page": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      const page = await getPage(brainId, slug);
      if (!page) return { error: `Page not found: ${slug}` };
      const [links, timeline] = await Promise.all([getPageLinks(brainId, slug), getTimeline(brainId, slug)]);
      return { ...page, links, timeline };
    }
    case "get_links": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      return await getPageLinks(brainId, slug);
    }
    case "get_backlinks": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      const links = await getPageLinks(brainId, slug);
      return links.incoming;
    }
    case "get_timeline": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      return await getTimeline(brainId, slug);
    }
    case "get_health":
      return await getHealth(brainId);
    case "get_stats":
      return await getStats(brainId);
    case "get_graph":
      return await getGraphData(brainId);
    case "query": {
      const question = params.question as string;
      if (!question) throw new Error("Missing 'question' parameter");
      return await searchBrain(brainId, question);
    }
    case "list_pages": {
      return await listPages(brainId, {
        type: params.type as string | undefined,
        limit: params.limit as number | undefined,
        offset: params.offset as number | undefined,
      });
    }
    case "traverse_graph": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      return await traverseGraph(brainId, slug, (params.depth as number) ?? 2, (params.direction as "out" | "in" | "both") ?? "out");
    }
    case "put_page": {
      const slug = params.slug as string;
      const title = params.title as string;
      if (!slug || !title) throw new Error("Missing 'slug' or 'title' parameter");
      return await putPage(brainId, { slug, title, type: params.type as string | undefined, content: params.content as string | undefined, frontmatter: params.frontmatter as Record<string, unknown> | undefined });
    }
    case "delete_page": {
      const slug = params.slug as string;
      if (!slug) throw new Error("Missing 'slug' parameter");
      const deleted = await deletePage(brainId, slug);
      return { success: deleted, slug };
    }
    case "add_link": {
      const from = params.from as string;
      const to = params.to as string;
      if (!from || !to) throw new Error("Missing 'from' or 'to' parameter");
      const created = await addLink(brainId, from, to, params.link_type as string | undefined);
      return { success: created, from, to, link_type: params.link_type || "related" };
    }
    case "remove_link": {
      const from = params.from as string;
      const to = params.to as string;
      if (!from || !to) throw new Error("Missing 'from' or 'to' parameter");
      const removed = await removeLink(brainId, from, to);
      return { success: removed, from, to };
    }
    case "add_timeline_entry": {
      const slug = params.slug as string;
      const date = params.date as string;
      const summary = params.summary as string;
      if (!slug || !date || !summary) throw new Error("Missing 'slug', 'date', or 'summary' parameter");
      return await addTimelineEntry(brainId, { slug, date, summary, detail: params.detail as string | undefined, source: params.source as string | undefined });
    }
    default:
      throw new Error(`Unknown tool: ${method}`);
  }
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing Authorization header. Use: Bearer bb_live_..." } }, { status: 401 });
  }

  const keyData = await validateApiKey(token);
  if (!keyData) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or revoked API key" } }, { status: 401 });
  }

  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  try {
    const { method, params } = body;

    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0", id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "brainbase", version: "1.0.0" },
        },
      });
    }

    if (method === "notifications/initialized") {
      return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: {} });
    }

    if (method === "tools/list") {
      return NextResponse.json({ jsonrpc: "2.0", id: body.id, result: { tools } });
    }

    if (method === "tools/call") {
      const toolParams = params as { name?: string; arguments?: Record<string, unknown> };
      if (!toolParams?.name) throw new Error("Missing tool name");
      const result = await dispatch(keyData.brainId, toolParams.name, toolParams.arguments || {});
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return NextResponse.json({
        jsonrpc: "2.0", id: body.id,
        result: { content: [{ type: "text", text }] },
      });
    }

    return NextResponse.json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: `Method not found: ${method}` } }, { status: 404 });
  } catch (err) {
    return NextResponse.json({
      jsonrpc: "2.0", id: body.id,
      error: { code: -32000, message: err instanceof Error ? err.message : "Internal error" },
    }, { status: 500 });
  }
}

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const event = JSON.stringify({
        jsonrpc: "2.0",
        method: "endpoint",
        params: { uri: "/api/mcp" },
      });
      controller.enqueue(encoder.encode(`data: ${event}\n\n`));

      const interval = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 30000);

      (stream as any).__cleanup = () => {
        closed = true;
        clearInterval(interval);
      };
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
