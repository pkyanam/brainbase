import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { getIngestor } from "@/lib/ingestors/types";
import { putPage, addLink } from "@/lib/supabase/write";

// Import for side-effect registration (Next.js tree-shakes otherwise)
import "@/lib/ingestors/github";

interface IngestStats {
  items_fetched: number;
  pages_created: number;
  links_created: number;
  errors: string[];
  duration_seconds: number;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const stats: IngestStats = {
    items_fetched: 0,
    pages_created: 0,
    links_created: 0,
    errors: [],
    duration_seconds: 0,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const { token, repos } = body as {
      token?: string;
      repos?: string;
    };

    if (!token) {
      return NextResponse.json(
        { error: "Missing GitHub personal access token" },
        { status: 400 }
      );
    }

    const ingestor = getIngestor("github");
    if (!ingestor) {
      return NextResponse.json(
        { error: "GitHub ingestor not found" },
        { status: 500 }
      );
    }

    // Authenticate
    await ingestor.authenticate({
      GITHUB_TOKEN: token,
      GITHUB_REPOS: repos ?? "",
    });

    // Fetch documents
    const { documents } = await ingestor.fetch(null);
    stats.items_fetched = documents.length;

    // Transform and write
    for (const doc of documents) {
      try {
        const drafts = await ingestor.transform(doc);
        for (const draft of drafts) {
          await putPage(auth.brainId, {
            slug: draft.slug,
            title: draft.title,
            type: draft.type,
            content: draft.content,
          });
          stats.pages_created++;

          // Write links
          if (draft.links) {
            for (const link of draft.links) {
              try {
                await addLink(auth.brainId, draft.slug, link.to, link.type);
                stats.links_created++;
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                stats.errors.push(`link ${draft.slug}->${link.to}: ${msg}`);
              }
            }
          }

          // Write timeline entries
          if (draft.timeline) {
            for (const t of draft.timeline) {
              try {
                const { addTimelineEntry } = await import("@/lib/supabase/write");
                await addTimelineEntry(auth.brainId, {
                  slug: draft.slug,
                  date: t.date,
                  summary: t.summary,
                  detail: t.detail,
                  source: draft.provenance.system,
                  written_by: draft.writtenBy,
                });
              } catch {
                // Non-fatal
              }
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        stats.errors.push(`${doc.id}: ${msg}`);
      }
    }

    stats.duration_seconds = Math.round((Date.now() - start) / 100) / 10;
    return NextResponse.json(stats);
  } catch (e: unknown) {
    stats.duration_seconds = Math.round((Date.now() - start) / 100) / 10;
    return NextResponse.json(
      {
        error: "GitHub ingestion failed",
        message: e instanceof Error ? e.message : "Unknown error",
        ...stats,
      },
      { status: 500 }
    );
  }
}
