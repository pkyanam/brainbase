import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWikiBrain, listWikiPages } from "@/lib/wiki";
import Footer from "@/components/Footer";

export const revalidate = 30;
export const dynamic = "force-dynamic";

type Params = { username: string };

export default async function WikiHome({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const brain = await loadWikiBrain(username);
  if (!brain) notFound();

  const pages = await listWikiPages(username, { limit: 500 });

  // Group pages by type for the directory view
  const byType = new Map<string, typeof pages>();
  for (const p of pages) {
    const list = byType.get(p.type) ?? [];
    list.push(p);
    byType.set(p.type, list);
  }
  const types = Array.from(byType.keys()).sort();

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <header className="border-b border-bb-border">
        <div className="max-w-5xl mx-auto px-5 md:px-6 py-10">
          <div className="text-xs uppercase tracking-wider text-bb-text-muted mb-3">
            Powered by Brainbase
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {brain.wiki_title || brain.name}
          </h1>
          {brain.wiki_tagline ? (
            <p className="mt-3 text-bb-text-secondary max-w-2xl">{brain.wiki_tagline}</p>
          ) : null}
          <div className="mt-4 text-sm text-bb-text-muted">
            {pages.length} public {pages.length === 1 ? "page" : "pages"} across {types.length}{" "}
            {types.length === 1 ? "category" : "categories"}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-6 py-10">
        {pages.length === 0 ? (
          <div className="text-bb-text-muted">
            This wiki is empty. The owner hasn&apos;t published any pages yet.
          </div>
        ) : (
          <div className="space-y-10">
            {types.map((type) => {
              const list = (byType.get(type) ?? []).sort((a, b) => a.title.localeCompare(b.title));
              return (
                <section key={type}>
                  <h2 className="text-sm uppercase tracking-wider text-bb-text-muted mb-3">
                    {type} <span className="text-bb-text-muted/60">· {list.length}</span>
                  </h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                    {list.map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`/b/${username}/${p.slug}`}
                          className="block py-1.5 text-bb-text-primary hover:text-bb-accent transition-colors"
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
