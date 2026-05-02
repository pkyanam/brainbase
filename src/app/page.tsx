import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary overflow-x-hidden">
      <Nav />

      {/* ═══════════════════════════════════════════════════════
          HERO — Asymmetric diagonal split
         ═══════════════════════════════════════════════════════ */}
      <section className="relative -mt-[1px] border-b border-bb-border">
        {/* Background accent */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Diagonal slash through the hero */}
          <div
            className="absolute top-0 right-0 w-[60%] h-full opacity-[0.03]"
            style={{
              background:
                "linear-gradient(135deg, transparent 40%, var(--bb-accent) 40%, var(--bb-accent) 42%, transparent 42%)",
            }}
          />
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,var(--bb-accent-glow),transparent_60%)] opacity-50" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 md:px-6 pt-24 md:pt-36 pb-20 md:pb-28">
          {/* Asymmetric layout: left text block + right floating element */}
          <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-8 md:gap-12 items-center">
            {/* Left: headline block — offset vertically from center */}
            <div className="space-y-6 md:-translate-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bb-surface border border-bb-border text-xs text-bb-text-muted select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
                Memory layer for AI agents
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.0]">
                <span className="block text-bb-text-primary">
                  Your company&apos;s
                </span>
                <span className="block text-bb-text-primary">
                  brain, structured
                </span>
                <span className="block bg-gradient-to-r from-bb-accent via-bb-accent-strong to-bb-accent bg-clip-text text-transparent">
                  for AI agents
                </span>
              </h1>

              <p className="text-base md:text-lg text-bb-text-secondary max-w-lg leading-relaxed">
                A self-enriching knowledge graph that gives every AI agent in your
                stack persistent, queryable memory. Postgres-backed. MCP-native.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                <a
                  href="/sign-up"
                  className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Get started free
                </a>
                <a
                  href="/demo"
                  className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center border border-bb-border hover:border-bb-border-hover text-bb-text-primary font-medium rounded-xl transition-all hover:bg-bb-surface group"
                >
                  <span>View interactive demo</span>
                  <svg
                    className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </a>
              </div>
            </div>

            {/* Right: floating stat/feature cluster — breaks grid */}
            <div className="relative space-y-4 md:space-y-5 md:translate-y-6">
              {/* Floating card 1 — offset left into gap */}
              <div className="relative ml-0 md:-ml-8 bg-bb-bg-secondary/90 backdrop-blur border border-bb-border rounded-2xl p-5 shadow-lg rotate-[0.5deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-bb-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-bb-text-muted uppercase tracking-wider">
                      Search
                    </div>
                    <div className="text-sm font-semibold text-bb-text-primary">
                      7-stage hybrid pipeline
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-bb-text-muted font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    FTS
                  </span>
                  <span className="text-bb-border-strong">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    pgvector
                  </span>
                  <span className="text-bb-border-strong">→</span>
                  <span className="px-1.5 py-0.5 rounded bg-bb-accent/10 border border-bb-accent/20 text-bb-accent">
                    RRF
                  </span>
                </div>
              </div>

              {/* Floating card 2 — offset right */}
              <div className="relative mr-0 md:mr-6 bg-bb-bg-secondary/90 backdrop-blur border border-bb-border rounded-2xl p-5 shadow-lg -rotate-[0.5deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-bb-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-bb-text-muted uppercase tracking-wider">
                      Dream Cycle
                    </div>
                    <div className="text-sm font-semibold text-bb-text-primary">
                      Autonomous enrichment
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs text-bb-text-muted font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    extract
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    embed
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    orphans
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border">
                    patterns
                  </span>
                </div>
              </div>

              {/* Floating card 3 — shadow of stats */}
              <div className="relative ml-0 md:ml-4 bg-bb-bg-secondary/70 backdrop-blur border border-bb-border rounded-2xl p-4 text-center rotate-[0.25deg] hover:rotate-0 transition-transform max-w-[280px] mx-auto md:mx-0">
                <div className="text-[10px] uppercase tracking-widest text-bb-text-muted mb-1">
                  Every interface
                </div>
                <div className="flex items-center justify-center gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-bb-accent font-mono text-base">
                      SDK
                    </span>
                    <span className="text-bb-text-muted">npm</span>
                  </div>
                  <span className="text-bb-border-strong">|</span>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-bb-text-primary font-mono text-base">
                      CLI
                    </span>
                    <span className="text-bb-text-muted">terminal</span>
                  </div>
                  <span className="text-bb-border-strong">|</span>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-bb-accent font-mono text-base">
                      MCP
                    </span>
                    <span className="text-bb-text-muted">12 tools</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          THE PROBLEM — Asymmetric interview-style layout
         ═══════════════════════════════════════════════════════ */}
      <section
        className="relative py-24 md:py-32 border-b border-bb-border"
        style={{
          background:
            "linear-gradient(180deg, var(--bb-bg-primary) 0%, var(--bb-bg-secondary) 100%)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          {/* Asymmetric two-panel: left narrow, right wide */}
          <div className="grid md:grid-cols-[0.55fr_1fr] gap-8 md:gap-16 items-start">
            {/* Left: stripped-down label + provocative question */}
            <div className="md:sticky md:top-24 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-px bg-bb-accent" />
                <span className="text-xs uppercase tracking-widest text-bb-accent font-medium">
                  The gap
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                AI agents don&apos;t
                <br />
                operate on vibes
              </h2>
            </div>

            {/* Right: the real meat */}
            <div className="space-y-8">
              <div className="space-y-5">
                <p className="text-base md:text-lg text-bb-text-secondary leading-relaxed">
                  Your company runs because <em>humans</em> remember: who handles
                  refunds, which pricing tiers need legal review, what was decided
                  in that Slack thread three months ago.
                </p>
                <p className="text-base text-bb-text-secondary leading-relaxed">
                  AI agents don&apos;t have that memory. Feed them raw Slack or
                  docs and they drown in noise. They need structured, attributed,
                  queryable knowledge — not another RAG pile.
                </p>
              </div>

              {/* Comparison block — asymmetric stacking */}
              <div className="space-y-3">
                {/* Fail case — offset right */}
                <div className="relative ml-4 md:ml-12 bg-bb-bg-primary/80 border border-bb-danger/20 rounded-xl p-4 max-w-md">
                  <div className="flex items-start gap-3">
                    <span className="text-bb-danger text-sm font-mono mt-0.5">
                      ✕
                    </span>
                    <div>
                      <div className="text-sm font-medium text-bb-danger mb-0.5">
                        RAG over Slack
                      </div>
                      <div className="text-xs text-bb-text-muted">
                        47 irrelevant threads. Zero context about who decided what.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fail case — offset left */}
                <div className="relative mr-4 md:mr-12 ml-8 md:ml-0 bg-bb-bg-primary/80 border border-bb-warning/20 rounded-xl p-4 max-w-md">
                  <div className="flex items-start gap-3">
                    <span className="text-bb-warning text-sm font-mono mt-0.5">
                      ✕
                    </span>
                    <div>
                      <div className="text-sm font-medium text-bb-warning mb-0.5">
                        Company wiki
                      </div>
                      <div className="text-xs text-bb-text-muted">
                        Outdated. Three different versions. No one maintains it.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Win case — full width-ish, accent-border */}
                <div className="relative bg-bb-surface border border-bb-accent/30 rounded-xl p-4 max-w-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-bb-accent text-sm font-mono mt-0.5">
                      ✓
                    </span>
                    <div>
                      <div className="text-sm font-medium text-bb-accent mb-0.5">
                        Brainbase
                      </div>
                      <div className="text-xs text-bb-text-secondary leading-relaxed">
                        4 people involved · 12 precedent decisions · 1 unwritten
                        rule surfaced · Confidence scored · Source-attributed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          THREE WAYS IN — Asymmetric cluster
         ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 border-b border-bb-border">
        {/* Diagonal background slash */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            background:
              "linear-gradient(155deg, var(--bb-accent) 0%, transparent 30%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-16 md:mb-20 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-px bg-bb-accent" />
                <span className="text-xs uppercase tracking-widest text-bb-accent font-medium">
                  Access
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Three interfaces.
                <br />
                <span className="text-bb-text-secondary">One brain.</span>
              </h2>
            </div>
            <p className="text-sm text-bb-text-muted max-w-xs">
              Same knowledge graph, delivered the way you work — npm package,
              terminal command, or native MCP tool.
            </p>
          </div>

          {/* Asymmetric card cluster — NOT a grid, intentionally offset */}
          <div className="relative space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {/* Card 1: SDK — top */}
            <div className="relative bg-bb-bg-secondary border border-bb-border rounded-2xl p-6 hover:border-bb-border-hover transition-colors md:-translate-y-4 group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-bb-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 2l4 4-10 10-4-1-1-4 10-10h1z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-text-primary">SDK</h3>
                  <p className="text-xs text-bb-text-muted">npm install</p>
                </div>
              </div>
              <pre className="text-xs text-bb-text-secondary bg-bb-bg-primary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed border border-bb-border group-hover:border-bb-accent/20 transition-colors">
                <code>{`import { Brainbase } from "brainbase-sdk";

const brain = new Brainbase({
  apiKey: "bb_live_..."
});

// Natural language query
const results = await brain
  .query("who handles refunds?");

// Read a page
const page = await brain
  .getPage("people/garry-tan");

// Brain health stats
const health = await brain.health();`}</code>
              </pre>
            </div>

            {/* Card 2: CLI — middle, no offset */}
            <div className="relative bg-bb-bg-secondary border border-bb-border rounded-2xl p-6 hover:border-bb-border-hover transition-colors group z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-bb-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-text-primary">CLI</h3>
                  <p className="text-xs text-bb-text-muted">Terminal-native</p>
                </div>
              </div>
              <pre className="text-xs text-bb-text-secondary bg-bb-bg-primary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed border border-bb-border group-hover:border-bb-accent/20 transition-colors">
                <code>{`$ brainbase search "pricing exceptions"

$ brainbase health
  Pages:  3,383    Links:   2,891
  Embed:  97.4%    Score:      87

$ brainbase page people/garry-tan

$ brainbase links people/julian-assange

$ brainbase graph`}</code>
              </pre>
            </div>

            {/* Card 3: MCP — bottom */}
            <div className="relative bg-bb-bg-secondary border border-bb-border rounded-2xl p-6 hover:border-bb-border-hover transition-colors md:translate-y-4 group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-bb-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-bb-text-primary">MCP</h3>
                  <p className="text-xs text-bb-text-muted">12 JSON-RPC tools</p>
                </div>
              </div>
              <pre className="text-xs text-bb-text-secondary bg-bb-bg-primary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed border border-bb-border group-hover:border-bb-accent/20 transition-colors">
                <code>{`// Drop into Claude Code, Cursor,
// OpenCode, or ChatGPT Desktop
{
  "mcpServers": {
    "brainbase": {
      "url": "https://brainbase
        .belweave.ai/api/mcp"
    }
  }
}

Tools: search, query, get_page,
get_links, get_backlinks,
get_timeline, get_health,
get_stats, get_graph,
list_pages, traverse_graph,
list_triggers`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          ARCHITECTURE — Diagonal offset blocks
         ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 border-b border-bb-border overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-16">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-px bg-bb-accent" />
              <span className="text-xs uppercase tracking-widest text-bb-accent font-medium">
                Architecture
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Postgres at the core.
              <br />
              <span className="text-bb-text-secondary">
                AI agents at the edge.
              </span>
            </h2>
          </div>

          {/* Asymmetric block stack — each layer progressively indented */}
          <div className="space-y-4 max-w-3xl">
            {/* Clients — offset right */}
            <div className="ml-0 sm:ml-8 md:ml-16 bg-bb-bg-secondary border border-bb-border rounded-xl p-5 hover:border-bb-border-hover transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold text-bb-text-muted uppercase tracking-widest w-12 shrink-0">
                  Clients
                </span>
                <span className="h-px flex-1 bg-bb-border" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-bb-accent-glow border border-bb-accent/20 text-bb-accent font-mono">
                  Web UI
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  AI Agents (MCP)
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  CLI (brainbase)
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  SDK (npm)
                </span>
              </div>
            </div>

            {/* API — offset left */}
            <div className="mr-0 sm:mr-8 md:mr-16 ml-0 bg-bb-bg-secondary border border-bb-border rounded-xl p-5 hover:border-bb-border-hover transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold text-bb-text-muted uppercase tracking-widest w-12 shrink-0">
                  API
                </span>
                <span className="h-px flex-1 bg-bb-border" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  REST
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-accent-glow border border-bb-accent/20 text-bb-accent font-mono">
                  MCP (12 tools)
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  Cron
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  Public /b/···
                </span>
              </div>
            </div>

            {/* Database — offset right */}
            <div className="ml-0 sm:ml-12 md:ml-24 bg-bb-bg-secondary border border-bb-accent/20 rounded-xl p-5 hover:border-bb-accent/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold text-bb-text-muted uppercase tracking-widest w-12 shrink-0">
                  DB
                </span>
                <span className="h-px flex-1 bg-bb-border" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-bb-accent-glow border border-bb-accent/20 text-bb-accent font-mono">
                  Supabase Postgres
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  pgvector
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  pages
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  links
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  content_chunks
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary font-mono">
                  timeline_entries
                </span>
              </div>
            </div>

            {/* Dream Cycle — offset left, accent */}
            <div className="mr-0 sm:mr-8 md:mr-16 ml-4 sm:ml-16 md:ml-32 bg-bb-accent-glow border border-bb-accent/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold text-bb-accent uppercase tracking-widest w-12 shrink-0">
                  Dream
                </span>
                <span className="h-px flex-1 bg-bb-accent/20" />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-bb-accent/10 border border-bb-accent/20 text-bb-accent font-mono">
                  extract
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-accent/10 border border-bb-accent/20 text-bb-accent font-mono">
                  embed
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-accent/10 border border-bb-accent/20 text-bb-accent font-mono">
                  orphans
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-accent/10 border border-bb-accent/20 text-bb-accent font-mono">
                  patterns
                </span>
                <span className="px-2 py-1 rounded-md bg-bb-accent/10 border border-bb-accent/20 text-bb-accent font-mono">
                  entity tiers
                </span>
              </div>
              <p className="text-xs text-bb-accent/70 mt-3 leading-relaxed">
                Nightly autonomous cycle. Extracts wikilinks + timelines,
                generates embeddings, reconnects orphans, escalates entities.
                Runs without any human input.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          FEATURES — Staggered vertical rhythm
         ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 border-b border-bb-border">
        {/* Subtle diagonal lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
          <div className="absolute top-0 left-0 w-[200%] h-0.5 bg-bb-accent -rotate-[15deg] origin-top-left" />
          <div className="absolute top-[33%] left-0 w-[200%] h-0.5 bg-bb-accent -rotate-[15deg] origin-top-left" />
          <div className="absolute top-[66%] left-0 w-[200%] h-0.5 bg-bb-accent -rotate-[15deg] origin-top-left" />
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="mb-16">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-px bg-bb-accent" />
              <span className="text-xs uppercase tracking-widest text-bb-accent font-medium">
                Capabilities
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Everything your agents need
            </h2>
          </div>

          {/* Staggered feature rows — alternating indent */}
          <div className="space-y-12 md:space-y-20">
            {/* Feature 1: Hybrid Search — left-aligned */}
            <div className="grid md:grid-cols-[1fr_1.3fr] gap-6 md:gap-10 items-start">
              <div>
                <div className="text-xs font-mono text-bb-accent mb-2">
                  01
                </div>
                <h3 className="text-xl font-bold mb-2">Hybrid search</h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">
                  Not just keyword, not just vector. A 7-stage gated pipeline:
                  full-text search → pgvector similarity → reciprocal rank fusion
                  → compiled truth boost → backlink boost → intent-aware
                  re-ranking → structured query handlers.
                </p>
              </div>
              <div className="bg-bb-bg-secondary border border-bb-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-bb-border flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                  <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                  <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                  <span className="text-[10px] font-mono text-bb-text-muted ml-2">
                    pipeline
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center gap-1.5 text-[10px] font-mono overflow-x-auto">
                  {[
                    "FTS",
                    "→",
                    "vector",
                    "→",
                    "RRF",
                    "→",
                    "truth",
                    "→",
                    "backlink",
                    "→",
                    "intent",
                    "→",
                    "handler",
                  ].map((stage, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 rounded whitespace-nowrap ${
                        stage === "→"
                          ? "text-bb-border-strong"
                          : i === 10
                          ? "bg-bb-accent/10 text-bb-accent border border-bb-accent/20"
                          : "bg-bb-bg-tertiary text-bb-text-secondary border border-bb-border"
                      }`}
                    >
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature 2: Typed Links — offset right */}
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 md:gap-10 items-start">
              <div className="md:order-2">
                <div className="text-xs font-mono text-bb-accent mb-2">
                  02
                </div>
                <h3 className="text-xl font-bold mb-2">Typed knowledge graph</h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">
                  Every connection has semantic meaning — not just &ldquo;related
                  to.&rdquo; People have roles. Companies have investments.
                  Projects have owners. Decisions have preconditions. The graph
                  knows the difference.
                </p>
              </div>
              <div className="md:order-1 bg-bb-bg-secondary border border-bb-border rounded-xl p-3">
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {[
                    "invested_in",
                    "works_at",
                    "owned_by",
                    "reports_to",
                    "depends_on",
                    "conflicts_with",
                    "supersedes",
                    "mentions",
                    "authored_by",
                  ].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border text-bb-text-secondary"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="px-1.5 py-0.5 rounded bg-bb-bg-tertiary border border-bb-border text-bb-text-muted italic">
                    ...any type
                  </span>
                </div>
              </div>
            </div>

            {/* Feature 3: Integrations — left-aligned */}
            <div className="grid md:grid-cols-[1fr_1.3fr] gap-6 md:gap-10 items-start">
              <div>
                <div className="text-xs font-mono text-bb-accent mb-2">
                  03
                </div>
                <h3 className="text-xl font-bold mb-2">Ingest from anywhere</h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">
                  Connect Slack and your agents extract entities, links, and
                  decisions automatically. GitHub ingestion pulls in code,
                  issues, and PR context. More integrations on the roadmap.
                </p>
              </div>
              <div className="bg-bb-bg-secondary border border-bb-border rounded-xl p-4 flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#4A154B]/10 border border-[#4A154B]/20 text-xs">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
                  </svg>
                  <span>Slack</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bb-bg-tertiary border border-bb-border text-xs">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>GitHub</span>
                </div>
                <span className="text-xs text-bb-text-muted italic">
                  More coming
                </span>
              </div>
            </div>

            {/* Feature 4: Skills Files — offset right */}
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-6 md:gap-10 items-start">
              <div className="md:order-2">
                <div className="text-xs font-mono text-bb-accent mb-2">
                  04
                </div>
                <h3 className="text-xl font-bold mb-2">Skills file export</h3>
                <p className="text-sm text-bb-text-secondary leading-relaxed">
                  Export scoped, attributed, confidence-scored knowledge to any
                  AI agent. Each skills file includes sources, precedents,
                  relevant people, and tasks — so your agents make correct
                  decisions the first time.
                </p>
              </div>
              <div className="md:order-1 bg-bb-bg-secondary border border-bb-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-bb-border">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                    <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                    <span className="w-2 h-2 rounded-full bg-bb-border-strong" />
                  </div>
                  <span className="text-[10px] font-mono text-bb-text-muted">
                    skills-file.json
                  </span>
                </div>
                <pre className="p-3 text-[10px] text-bb-text-secondary leading-relaxed font-mono overflow-x-auto">
                  <code>{`{
  "task": "pricing_exception",
  "confidence": 0.94,
  "rules": [
    {
      "condition": "deal < $50K",
      "owner": "sales_manager",
      "precedents": 23
    },
    {
      "condition": "deal >= $100K",
      "owner": "legal",
      "escalation_required": true
    }
  ],
  "people": ["Alice (Sales)",
             "Bob (Legal)"],
  "sources": ["slack", "linear"]
}`}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DEMO CTA — Asymmetric final push
         ═══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_100%,var(--bb-accent-glow),transparent_60%)] pointer-events-none opacity-50" />

        <div className="relative max-w-6xl mx-auto px-5 md:px-6">
          {/* Asymmetric split: big image ref left, CTA right */}
          <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 md:gap-16 items-center">
            {/* Left: demo preview reference */}
            <div className="relative order-2 md:order-1">
              {/* Fake browser chrome — representing the 3D graph */}
              <div className="bg-bb-bg-secondary border border-bb-border rounded-2xl overflow-hidden shadow-2xl rotate-[-0.5deg] hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-bb-border">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
                    <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
                    <span className="w-2.5 h-2.5 rounded-full bg-bb-border-strong" />
                  </div>
                  <span className="text-[10px] font-mono text-bb-text-muted ml-2">
                    brainbase.belweave.ai/demo
                  </span>
                </div>
                <div className="p-6 md:p-8 space-y-4">
                  {/* Abstract graph representation */}
                  <div className="relative h-48 md:h-56 rounded-xl bg-bb-bg-primary border border-bb-border overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="space-y-3 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full border-2 border-bb-accent/30 bg-bb-accent-glow flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-bb-accent"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1}
                          >
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="5" cy="19" r="2" />
                            <circle cx="19" cy="19" r="2" />
                            <line x1="12" y1="7" x2="5" y2="17" />
                            <line x1="12" y1="7" x2="19" y2="17" />
                            <line x1="5" y1="19" x2="19" y2="19" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-bb-text-primary">
                            Interactive 3D Knowledge Graph
                          </p>
                          <p className="text-xs text-bb-text-muted mt-1">
                            Watch an AI agent reason through company knowledge
                            in real-time
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mini trace */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex-1 h-1 rounded-full bg-bb-bg-tertiary overflow-hidden">
                      <div className="w-3/4 h-full rounded-full bg-bb-accent" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-bb-accent" />
                      <span className="w-1.5 h-1.5 rounded-full bg-bb-accent/40" />
                      <span className="w-1.5 h-1.5 rounded-full bg-bb-accent/40" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 md:right-auto md:left-[60%] bg-bb-accent text-bb-bg-primary text-xs font-bold px-3 py-1.5 rounded-full shadow-lg rotate-[4deg] select-none">
                No signup required
              </div>
            </div>

            {/* Right: CTA */}
            <div className="order-1 md:order-2 space-y-6">
              <div className="flex items-center gap-2">
                <span className="w-8 h-px bg-bb-accent" />
                <span className="text-xs uppercase tracking-widest text-bb-accent font-medium">
                  See it work
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                Watch an agent reason
                <br />
                <span className="text-bb-text-secondary">
                  through a live brain
                </span>
              </h2>
              <p className="text-bb-text-secondary leading-relaxed max-w-sm">
                Our interactive demo shows how Brainbase ingests knowledge,
                builds a typed graph, and generates executable skills files for
                AI agents. Public endpoint — no auth, no signup, just the raw
                brain at work.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
                <a
                  href="/demo"
                  className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
                >
                  Launch interactive demo
                  <svg
                    className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </a>
                <a
                  href="/docs"
                  className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center border border-bb-border hover:border-bb-border-hover text-bb-text-primary font-medium rounded-xl transition-all hover:bg-bb-surface"
                >
                  Read the docs
                </a>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
                <div>
                  <div className="text-lg font-bold text-bb-accent font-mono">
                    3,383+
                  </div>
                  <div className="text-xs text-bb-text-muted">
                    pages in production
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-bb-text-primary font-mono">
                    97.4%
                  </div>
                  <div className="text-xs text-bb-text-muted">
                    embed coverage
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold text-bb-text-primary font-mono">
                    12
                  </div>
                  <div className="text-xs text-bb-text-muted">MCP tools</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
