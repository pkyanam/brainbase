import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      {/* Hero */}
      <section className="relative border-b border-bb-border overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-bb-accent-glow),transparent_60%)] opacity-40 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-5 md:px-6 pt-20 md:pt-28 pb-16 md:pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bb-surface border border-bb-border text-xs text-bb-text-muted mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
            One click to a working knowledge graph
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 leading-[1.05]">
            Your company&apos;s brain,
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-bb-accent to-bb-accent-strong bg-clip-text text-transparent">
              {" "}for AI agents
            </span>
          </h1>
          <p className="text-base md:text-lg text-bb-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Every company runs on tribal knowledge scattered across Slack, email, and docs.
            Brainbase ingests it all, structures it into a living knowledge graph, and turns it into
            executable skills files for your AI agents.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/sign-up"
              className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-md transition-colors"
            >
              Get started free
            </a>
            <a
              href="/demo"
              className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center border border-bb-border hover:border-bb-border-strong hover:bg-bb-surface text-bb-text-primary font-medium rounded-md transition-colors"
            >
              View demo
            </a>
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="border-b border-bb-border py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <div className="grid md:grid-cols-2 gap-10 md:gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-bb-accent font-medium mb-3">The problem</p>
              <h2 className="text-2xl md:text-3xl font-semibold mb-4 tracking-tight">
                AI agents can&apos;t operate on vibes
              </h2>
              <p className="text-bb-text-secondary leading-relaxed mb-4">
                Your company works because humans vaguely remember how refunds get handled,
                which pricing exceptions need legal review, and who to loop in on an incident.
              </p>
              <p className="text-bb-text-secondary leading-relaxed">
                But AI agents don&apos;t have that intuition. They need structured, queryable,
                attributed company knowledge, not a pile of documents to search.
              </p>
            </div>
            <div className="bg-bb-bg-secondary border border-bb-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-bb-border flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-bb-accent" />
                <span className="text-xs font-mono text-bb-text-muted">agent.query</span>
              </div>
              <div className="p-5">
                <p className="text-sm text-bb-text-primary mb-4 leading-relaxed">
                  &quot;How do pricing exceptions over $100k get decided at this company?&quot;
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-bb-danger">
                    <span className="font-mono shrink-0">x</span>
                    <span className="text-bb-text-secondary">RAG over Slack: 47 irrelevant threads</span>
                  </div>
                  <div className="flex items-start gap-2 text-bb-danger">
                    <span className="font-mono shrink-0">x</span>
                    <span className="text-bb-text-secondary">Company wiki: outdated, nobody maintains it</span>
                  </div>
                  <div className="flex items-start gap-2 text-bb-accent">
                    <span className="font-mono shrink-0">✓</span>
                    <span className="text-bb-text-primary">Brainbase: 4 people involved, 12 precedent decisions, unwritten rule flagged</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-bb-border py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-5 md:px-6">
          <p className="text-xs uppercase tracking-widest text-bb-accent font-medium mb-3 text-center">How it works</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12 tracking-tight">
            Three primitives, one living graph
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
            {[
              {
                step: "01",
                title: "Ingest",
                body: "Connect Slack to extract entities, links, and decisions automatically. Additional integrations are on the roadmap.",
              },
              {
                step: "02",
                title: "Structure",
                body: "Typed pages, wikilinks, timeline entries, and embeddings build a queryable graph of how your company actually works.",
              },
              {
                step: "03",
                title: "Execute",
                body: "Export skills files scoped to any task. Your agents get attributed, confidence scored context and handle work correctly the first time.",
              },
            ].map((it) => (
              <div key={it.step} className="p-5 rounded-xl bg-bb-bg-secondary border border-bb-border hover:border-bb-border-strong transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-bb-accent">{it.step}</span>
                  <span className="h-px flex-1 bg-bb-border" />
                </div>
                <h3 className="font-semibold mb-2 text-bb-text-primary">{it.title}</h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">{it.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code preview */}
      <section className="border-b border-bb-border py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-5 md:px-6">
          <p className="text-xs uppercase tracking-widest text-bb-accent font-medium mb-3 text-center">The output</p>
          <h2 className="text-2xl md:text-3xl font-semibold mb-8 text-center tracking-tight">
            One API call. Your agents know the rules.
          </h2>
          <div className="bg-bb-bg-secondary border border-bb-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-bb-border">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
                <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
                <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
              </div>
              <span className="text-xs font-mono text-bb-text-muted ml-2">skills-file.json</span>
            </div>
            <pre className="p-5 text-xs md:text-sm text-bb-text-secondary overflow-x-auto leading-relaxed font-mono">
              <code>{`{
  "task": "pricing_exception",
  "confidence": 0.94,
  "sources": ["slack", "linear", "email"],
  "rules": [
    {
      "condition": "deal_value < 50000",
      "owner": "sales_manager",
      "precedents": 23,
      "confidence": 0.97
    },
    {
      "condition": "deal_value >= 100000",
      "owner": "legal",
      "escalation_required": true,
      "precedents": 8,
      "confidence": 0.91
    }
  ],
  "people": ["Alice (Sales)", "Bob (Legal)", "Carol (Finance)"],
  "last_updated": "2026-04-29T18:00:00Z"
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-5 md:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-4 tracking-tight">
            Built for AI-native teams
          </h2>
          <p className="text-bb-text-secondary mb-10 max-w-xl mx-auto leading-relaxed">
            We&apos;re working with a small group of early partners to refine the
            company brain primitive. If your team runs on AI agents and messy Slack,
            we should talk.
          </p>
          <a
            href="/apply"
            className="inline-flex h-11 px-6 items-center justify-center bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-md transition-colors"
          >
            Apply for early access
          </a>
          <p className="text-xs text-bb-text-muted mt-4">
            Limited to 10 teams. We review every application personally.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
