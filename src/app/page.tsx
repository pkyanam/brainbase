import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bb-bg-secondary border border-bb-border text-xs text-bb-text-muted mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
          YC W25 · Now accepting design partners
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Your company&apos;s brain,{" "}
          <span className="bg-gradient-to-r from-bb-accent to-bb-accent-dim bg-clip-text text-transparent">
            for AI agents
          </span>
        </h1>
        <p className="text-lg text-bb-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Every company runs on tribal knowledge scattered across Slack, email, and docs.
          Brainbase ingests it all, structures it into a living knowledge graph, and turns it into
          executable skills files for your AI agents.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/sign-up"
            className="w-full sm:w-auto px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors text-center"
          >
            Become a design partner
          </a>
          <a
            href="/docs"
            className="w-full sm:w-auto px-6 py-3 border border-bb-border hover:border-bb-border-hover text-bb-text-secondary font-medium rounded-xl transition-colors text-center"
          >
            Read docs
          </a>
        </div>
      </section>

      {/* Problem statement */}
      <section className="border-t border-bb-border py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold mb-4">AI agents can&apos;t operate on vibes</h2>
              <p className="text-bb-text-secondary leading-relaxed mb-4">
                Your company works because humans vaguely remember how refunds get handled,
                which pricing exceptions need legal review, and who to loop in on an incident.
              </p>
              <p className="text-bb-text-secondary leading-relaxed">
                But AI agents don&apos;t have that intuition. They need structured, queryable,
                attributed company knowledge — not a pile of documents to search.
              </p>
            </div>
            <div className="bg-bb-bg-secondary border border-bb-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-bb-accent/10 flex items-center justify-center">
                  <span className="text-bb-accent text-sm">❓</span>
                </div>
                <span className="text-sm font-medium text-bb-text-secondary">Agent asks:</span>
              </div>
              <p className="text-sm text-bb-text-muted mb-4">
                &quot;How do pricing exceptions over $100k get decided at this company?&quot;
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <span>✗</span> RAG over Slack: 47 irrelevant threads
                </div>
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <span>✗</span> Company wiki: outdated, nobody maintains it
                </div>
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <span>✓</span> Brainbase: 4 people involved, 12 precedent decisions, unwritten rule flagged
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">→</span>
              </div>
              <h3 className="font-semibold mb-2">Ingest</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Connect Slack, Gmail, Notion, Linear, GitHub. We extract entities,
                links, and decisions automatically.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">🧠</span>
              </div>
              <h3 className="font-semibold mb-2">Structure</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Typed pages, wikilinks, timeline entries, and embeddings build a
                queryable graph of how your company actually works.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">⚡</span>
              </div>
              <h3 className="font-semibold mb-2">Execute</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Export skills files scoped to any task. Your agents get attributed,
                confidence-scored context and handle work correctly the first time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code preview */}
      <section className="border-t border-bb-border py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold mb-6 text-center">One API call. Your agents know the rules.</h2>
          <div className="bg-bb-bg-secondary border border-bb-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-bb-border">
              <div className="w-3 h-3 rounded-full bg-red-500/20" />
              <div className="w-3 h-3 rounded-full bg-amber-500/20" />
              <div className="w-3 h-3 rounded-full bg-bb-accent/20" />
              <span className="text-xs text-bb-text-muted ml-2">skills-file.json</span>
            </div>
            <pre className="p-6 text-sm text-bb-text-secondary overflow-x-auto leading-relaxed">
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

      {/* Social proof / design partners */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Built for AI-native teams</h2>
          <p className="text-bb-text-secondary mb-12 max-w-xl mx-auto">
            We&apos;re working with a small group of design partners to refine the
            company brain primitive. If your team runs on AI agents and messy Slack,
            we should talk.
          </p>
          <a
            href="/sign-up"
            className="inline-block px-8 py-4 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors"
          >
            Apply for design partner program
          </a>
          <p className="text-xs text-bb-text-muted mt-4">
            Limited to 5 companies. YC W25 batch priority.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
