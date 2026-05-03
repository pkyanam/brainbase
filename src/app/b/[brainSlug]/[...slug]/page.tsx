import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadWikiBrain,
  loadWikiPage,
  loadWikiPageLinks,
  loadWikiTimeline,
} from "@/lib/wiki";
import Footer from "@/components/Footer";

export const revalidate = 30;
export const dynamic = "force-dynamic";

type Params = { brainSlug: string; slug: string[] };

export default async function WikiPageView({ params }: { params: Promise<Params> }) {
  const { brainSlug, slug: slugSegments } = await params;
  const pageSlug = slugSegments.join("/");

  const brain = await loadWikiBrain(brainSlug);
  if (!brain) notFound();

  const page = await loadWikiPage(brainSlug, pageSlug);
  if (!page) notFound();

  const [{ outgoing, incoming }, timeline] = await Promise.all([
    loadWikiPageLinks(brain.id, pageSlug),
    loadWikiTimeline(brain.id, pageSlug),
  ]);

  // Group outgoing links by link_type for the "Connections" sidebar section
  const connectionsByType = new Map<string, typeof outgoing>();
  for (const e of outgoing) {
    const list = connectionsByType.get(e.link_type) ?? [];
    list.push(e);
    connectionsByType.set(e.link_type, list);
  }

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <header className="border-b border-bb-border">
        <div className="max-w-6xl mx-auto px-5 md:px-6 py-5 flex items-baseline justify-between">
          <Link
            href={`/b/${brainSlug}`}
            className="text-sm text-bb-text-muted hover:text-bb-text-primary"
          >
            ← {brain.wiki_title || brain.name}
          </Link>
          <div className="text-xs uppercase tracking-wider text-bb-text-muted">{page.type}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 md:px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
        <article>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{page.title}</h1>
          <div className="text-sm text-bb-text-muted mb-6">
            <span className="font-mono">{page.slug}</span>
            <span className="mx-2">·</span>
            updated {new Date(page.updated_at).toISOString().slice(0, 10)}
          </div>

          <PageBody content={page.content} />

          {timeline.length > 0 ? (
            <section className="mt-12 border-t border-bb-border pt-8">
              <h2 className="text-lg font-semibold mb-4">Timeline</h2>
              <ol className="space-y-4">
                {timeline.map((t, i) => (
                  <li key={`${t.date}-${i}`} className="flex gap-4">
                    <time className="text-sm text-bb-text-muted font-mono shrink-0 w-24">
                      {t.date.slice(0, 10)}
                    </time>
                    <div className="text-sm">
                      <div className="text-bb-text-primary">{t.summary}</div>
                      {t.detail ? (
                        <div className="text-bb-text-muted mt-0.5">{t.detail}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {incoming.length > 0 ? (
            <section className="mt-12 border-t border-bb-border pt-8">
              <h2 className="text-lg font-semibold mb-4">Backlinks</h2>
              <ul className="space-y-1">
                {incoming.map((b) => (
                  <li key={`${b.slug}-${b.link_type}`} className="text-sm">
                    <Link
                      href={`/b/${brainSlug}/${b.slug}`}
                      className="text-bb-text-primary hover:text-bb-accent"
                    >
                      {b.title}
                    </Link>
                    <span className="ml-2 text-xs text-bb-text-muted font-mono">
                      {b.link_type}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        <aside className="space-y-6 lg:sticky lg:top-6 self-start text-sm">
          <SidebarSection title="Metadata">
            <dl className="space-y-1.5">
              <SidebarRow label="Type" value={page.type} />
              <SidebarRow label="Created" value={new Date(page.created_at).toISOString().slice(0, 10)} />
              <SidebarRow label="Updated" value={new Date(page.updated_at).toISOString().slice(0, 10)} />
              {page.tags && page.tags.length > 0 ? (
                <SidebarRow label="Tags" value={page.tags.join(", ")} />
              ) : null}
            </dl>
          </SidebarSection>

          {connectionsByType.size > 0 ? (
            <SidebarSection title="Connections">
              <div className="space-y-3">
                {Array.from(connectionsByType.entries()).map(([linkType, list]) => (
                  <div key={linkType}>
                    <div className="text-xs uppercase tracking-wider text-bb-text-muted mb-1">
                      {linkType}
                    </div>
                    <ul className="space-y-0.5">
                      {list.map((e) => (
                        <li key={e.slug}>
                          <Link
                            href={`/b/${brainSlug}/${e.slug}`}
                            className="text-bb-text-primary hover:text-bb-accent"
                          >
                            {e.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SidebarSection>
          ) : null}
        </aside>
      </main>

      <Footer />
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-bb-border rounded-lg p-4 bg-bb-surface">
      <h3 className="text-xs uppercase tracking-wider text-bb-text-muted mb-3">{title}</h3>
      {children}
    </div>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-bb-text-muted">{label}</dt>
      <dd className="text-bb-text-primary text-right break-words">{value}</dd>
    </div>
  );
}

/**
 * Minimal markdown-ish render: paragraphs, line breaks, and `[[slug]]` wikilinks
 * resolved into `<Link>` to other public pages on the same wiki.
 *
 * This is intentionally tiny and dependency-free for v1. A proper renderer
 * (remark + rehype) lands when the wiki ships richer content.
 */
function PageBody({ content }: { content: string }) {
  if (!content || !content.trim()) {
    return (
      <p className="text-bb-text-muted italic">No content yet.</p>
    );
  }
  const paragraphs = content.split(/\n{2,}/);
  return (
    <div className="prose prose-invert max-w-none">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-wrap leading-relaxed">
          {p}
        </p>
      ))}
    </div>
  );
}
