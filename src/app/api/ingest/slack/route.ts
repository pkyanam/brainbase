import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { getIngestor } from "@/lib/ingestors/types";
import { putPage, addLink } from "@/lib/supabase/write";

interface IngestStats {
  messages_fetched: number;
  pages_created: number;
  links_created: number;
  decisions_detected: number;
  errors: string[];
  duration_seconds: number;
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  const stats: IngestStats = {
    messages_fetched: 0,
    pages_created: 0,
    links_created: 0,
    decisions_detected: 0,
    errors: [],
    duration_seconds: 0,
  };

  try {
    const body = await req.json().catch(() => ({}));
    const { botToken, teamId, channels } = body as {
      botToken?: string;
      teamId?: string;
      channels?: string[];
    };

    if (!botToken || !teamId) {
      return NextResponse.json(
        { error: "Missing botToken or teamId" },
        { status: 400 }
      );
    }

    const ingestor = getIngestor("slack");
    if (!ingestor) {
      return NextResponse.json(
        { error: "Slack ingestor not found" },
        { status: 500 }
      );
    }

    // Authenticate
    await ingestor.authenticate({
      SLACK_BOT_TOKEN: botToken,
      SLACK_TEAM_ID: teamId,
      SLACK_CHANNELS: channels?.join(",") ?? "",
    });

    // Fetch documents
    const { documents } = await ingestor.fetch(null);
    stats.messages_fetched = documents.length;

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

          if (draft.type === "decision") {
            stats.decisions_detected++;
          }

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
        error: "Slack ingestion failed",
        message: e instanceof Error ? e.message : "Unknown error",
        ...stats,
      },
      { status: 500 }
    );
  }
}
