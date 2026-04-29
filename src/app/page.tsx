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
          Powered by GStack · Postgres-backed · MCP-native
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
          Give your AI agents{" "}
          <span className="bg-gradient-to-r from-bb-accent to-bb-accent-dim bg-clip-text text-transparent">
            a memory
          </span>
        </h1>
        <p className="text-lg text-bb-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          One API call. Your agents remember everything. Brainbase is the persistent knowledge layer
          that turns every AI agent into an expert on your world.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="/sign-up"
            className="px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors"
          >
            Get started free
          </a>
          <a
            href="/docs"
            className="px-6 py-3 border border-bb-border hover:border-bb-border-hover text-bb-text-secondary font-medium rounded-xl transition-colors"
          >
            Read docs
          </a>
        </div>
      </section>

      {/* Code preview */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="bg-bb-bg-secondary border border-bb-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-bb-border">
            <div className="w-3 h-3 rounded-full bg-red-500/20" />
            <div className="w-3 h-3 rounded-full bg-amber-500/20" />
            <div className="w-3 h-3 rounded-full bg-bb-accent/20" />
            <span className="text-xs text-bb-text-muted ml-2">example.ts</span>
          </div>
          <pre className="p-6 text-sm text-bb-text-secondary overflow-x-auto leading-relaxed">
            <code>{`import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({ apiKey: "bb_live_..." });

// Your agent asks a question
const results = await brain.query("who do I know at YC?");
// → [{ slug: "people/garry-tan", title: "Garry Tan", score: 0.97 }]

// Get full context
const page = await brain.getPage("people/garry-tan");
// → { content: "Garry Tan is the CEO of Y Combinator...", links: [...], timeline: [...] }

// Check brain health
const health = await brain.health();
// → { page_count: 687, link_count: 257, brain_score: 75 }`}</code>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-bb-border py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">🧠</span>
              </div>
              <h3 className="font-semibold mb-2">Self-enriching</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Your brain grows automatically. Links are extracted, timelines built, orphans reconnected — all while you sleep.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">🔗</span>
              </div>
              <h3 className="font-semibold mb-2">MCP-native</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Drop one URL into any MCP-compatible agent. Claude Code, Cursor, OpenCode — they all get instant memory.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-lg">⚡</span>
              </div>
              <h3 className="font-semibold mb-2">Postgres-backed</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Every user gets their own isolated database. pgvector for semantic search. Typed wikilinks for relational queries.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
