"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const DemoBrainScene = dynamic(() => import("@/components/DemoBrainScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-bb-accent/30 border-t-bb-accent rounded-full animate-spin" />
    </div>
  ),
});

/* ─── Agent Reasoning Trace ─────────────────────────────── */

interface ReasoningStep {
  text: string;
  highlightNodes: string[];
  highlightEdges: string[];
  delay: number;
}

const DEMO_QUERIES = [
  {
    label: "How do pricing exceptions work?",
    task: "pricing exceptions",
    steps: [
      { text: "Searching for 'pricing exceptions' in company brain...", highlightNodes: ["pricing-exceptions"], highlightEdges: [], delay: 800 },
      { text: "Found concept: Pricing Exceptions. 8 linked entities.", highlightNodes: ["pricing-exceptions"], highlightEdges: [], delay: 600 },
      { text: "Traversing ownership edges... Alice Chen (Sales) and Bob Martinez (Legal) are involved.", highlightNodes: ["pricing-exceptions", "alice-chen", "bob-martinez"], highlightEdges: ["pricing-exceptions-alice-chen", "pricing-exceptions-bob-martinez"], delay: 1000 },
      { text: "Two conditions detected: deals under $50K and deals over $100K.", highlightNodes: ["pricing-exceptions", "deal-value-50k", "deal-value-100k"], highlightEdges: ["pricing-exceptions-deal-value-50k", "pricing-exceptions-deal-value-100k"], delay: 800 },
      { text: "Precedent analysis: 23 decisions under $50K (Sales Manager approves). 8 decisions over $100K (requires Legal + escalation).", highlightNodes: ["deal-value-50k", "deal-value-100k", "sales-manager", "legal-review", "escalation-process"], highlightEdges: ["deal-value-50k-sales-manager", "deal-value-100k-legal-review", "deal-value-100k-escalation-process"], delay: 1200 },
      { text: "Alert: Unwritten rule detected. The $100K threshold was never formally documented but enforced in every precedent.", highlightNodes: ["unwritten-rule", "deal-value-100k"], highlightEdges: ["unwritten-rule-pricing-exceptions", "unwritten-rule-deal-value-100k"], delay: 1000 },
    ],
  },
  {
    label: "Who handles refunds?",
    task: "refund policy",
    steps: [
      { text: "Searching for 'refund' in company brain...", highlightNodes: ["refund-policy"], highlightEdges: [], delay: 800 },
      { text: "Found: Refund Policy. Owned by Finance Team.", highlightNodes: ["refund-policy", "finance-team"], highlightEdges: ["refund-policy-finance-team"], delay: 600 },
      { text: "Carol White (Finance) is the primary contact. Customer Success also handles initial triage.", highlightNodes: ["refund-policy", "carol-white", "customer-success", "finance-team"], highlightEdges: ["refund-policy-carol-white", "refund-policy-customer-success"], delay: 800 },
    ],
  },
];

/* ─── Main Demo Page ────────────────────────────────────── */

export default function DemoPage() {
  const [selectedQuery, setSelectedQuery] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showSkillsFile, setShowSkillsFile] = useState(false);
  const [skillsFile, setSkillsFile] = useState<unknown | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set());
  const [typedText, setTypedText] = useState("");
  const [customQuery, setCustomQuery] = useState("");
  const [customRunning, setCustomRunning] = useState(false);
  const [customTrace, setCustomTrace] = useState<string[]>([]);
  const [customTraceIdx, setCustomTraceIdx] = useState(0);
  const timeoutsRef = useRef<number[]>([]);

  const query = selectedQuery !== null ? DEMO_QUERIES[selectedQuery] : null;

  const clearTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const runQuery = useCallback((index: number) => {
    clearTimeouts();
    setSelectedQuery(index);
    setCurrentStep(0);
    setIsRunning(true);
    setShowSkillsFile(false);
    setSkillsFile(null);
    setSkillsLoading(false);
    setTypedText("");
    setActiveNodes(new Set());
    setActiveEdges(new Set());

    const q = DEMO_QUERIES[index];
    let accumulatedDelay = 0;

    q.steps.forEach((step, i) => {
      const t1 = window.setTimeout(() => {
        setCurrentStep(i);
        setActiveNodes(new Set(step.highlightNodes));
        setActiveEdges(new Set(step.highlightEdges));

        // Typewriter effect for the step text
        let charIndex = 0;
        setTypedText("");
        const typeInterval = window.setInterval(() => {
          charIndex++;
          setTypedText(step.text.slice(0, charIndex));
          if (charIndex >= step.text.length) {
            clearInterval(typeInterval);
          }
        }, 15);
        timeoutsRef.current.push(typeInterval);
      }, accumulatedDelay);
      timeoutsRef.current.push(t1);
      accumulatedDelay += step.delay + step.text.length * 15;
    });

    const t2 = window.setTimeout(() => {
      setIsRunning(false);
      setShowSkillsFile(true);
      setSkillsLoading(true);
      // Call public demo endpoint — no auth needed
      fetch(`/api/skills/demo?task=${encodeURIComponent(q.task)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setSkillsFile(data);
          }
        })
        .catch(() => {})
        .finally(() => setSkillsLoading(false));
    }, accumulatedDelay + 400);
    timeoutsRef.current.push(t2);
  }, [clearTimeouts]);

  const runCustomQuery = useCallback(() => {
    const q = customQuery.trim();
    if (!q || customRunning) return;
    clearTimeouts();
    setSelectedQuery(null);
    setIsRunning(false);
    setCustomRunning(true);
    setShowSkillsFile(false);
    setSkillsFile(null);
    setSkillsLoading(false);
    setActiveNodes(new Set());
    setActiveEdges(new Set());
    setCustomTraceIdx(0);

    const steps = [
      `Searching demo brain for "${q}"...`,
      `Traversing knowledge graph for related pages...`,
      `Extracting people, rules, and patterns...`,
      `Computing confidence scores...`,
    ];
    setCustomTrace(steps);

    let acc = 0;
    steps.forEach((_, i) => {
      const t = window.setTimeout(() => setCustomTraceIdx(i + 1), acc);
      timeoutsRef.current.push(t);
      acc += 500;
    });

    const t2 = window.setTimeout(() => {
      setSkillsLoading(true);
      fetch(`/api/skills/demo?task=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) setSkillsFile(data);
        })
        .catch(() => {})
        .finally(() => {
          setSkillsLoading(false);
          setCustomRunning(false);
          setShowSkillsFile(true);
        });
    }, acc + 200);
    timeoutsRef.current.push(t2);
  }, [customQuery, customRunning, clearTimeouts]);

  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  return (
    <div className="min-h-screen bg-bb-bg-primary text-bb-text-primary">
      <Nav />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bb-bg-secondary border border-bb-border text-xs text-bb-text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-bb-accent animate-pulse" />
            Interactive Demo
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            See how Brainbase{" "}
            <span className="bg-gradient-to-r from-bb-accent to-bb-accent-dim bg-clip-text text-transparent">
              extracts knowledge from your company data
            </span>
          </h1>
          <p className="text-lg text-bb-text-secondary max-w-2xl mx-auto">
            The skills engine traverses a real knowledge graph to surface people,
            rules, precedents, and implicit patterns — no LLMs, no hallucinations.
          </p>
        </div>
      </section>

      {/* Demo Interface */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: 3D Brain */}
          <div className="lg:col-span-3 h-[500px] rounded-2xl border border-bb-border overflow-hidden relative">
            <DemoBrainScene activeNodes={activeNodes} activeEdges={activeEdges} />
            <div className="absolute top-4 left-4 flex gap-2">
              <div className="px-2 py-1 rounded-md bg-bb-bg-secondary/80 border border-bb-border text-xs text-bb-text-muted">
                <span className="inline-block w-2 h-2 rounded-full bg-[#e8927c] mr-1.5" />
                Person
              </div>
              <div className="px-2 py-1 rounded-md bg-bb-bg-secondary/80 border border-bb-border text-xs text-bb-text-muted">
                <span className="inline-block w-2 h-2 rounded-full bg-bb-accent mr-1.5" />
                Concept
              </div>
              <div className="px-2 py-1 rounded-md bg-bb-bg-secondary/80 border border-bb-border text-xs text-bb-text-muted">
                <span className="inline-block w-2 h-2 rounded-full bg-[#8ec5e8] mr-1.5" />
                Company
              </div>
            </div>
            <div className="absolute bottom-4 left-4 text-xs text-bb-text-muted">
              Drag to rotate • Scroll to zoom
            </div>
          </div>

          {/* Right: Query Panel */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Query Selector */}
            <div className="p-4 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <h3 className="text-sm font-semibold text-bb-text-secondary mb-3">Ask the agent</h3>
              <div className="space-y-2">
                {DEMO_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => runQuery(i)}
                    disabled={isRunning}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                      selectedQuery === i
                        ? "bg-bb-accent/10 border border-bb-accent/30 text-bb-accent"
                        : "bg-bb-bg-tertiary border border-bb-border hover:border-bb-border-hover text-bb-text-secondary"
                    } disabled:opacity-50`}
                  >
                    {q.label}
                    {selectedQuery === i && isRunning && (
                      <span className="ml-2 inline-block w-3 h-3 border-2 border-bb-accent/30 border-t-bb-accent rounded-full animate-spin" />
                    )}
                  </button>
                ))}
              </div>
              {/* Divider */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-bb-border" />
                <span className="text-[10px] text-bb-text-muted uppercase tracking-wider">or try your own</span>
                <div className="flex-1 h-px bg-bb-border" />
              </div>
              {/* Custom query input */}
              <form
                onSubmit={(e) => { e.preventDefault(); runCustomQuery(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="e.g. enterprise tier, alice chen, bob martinez..."
                  disabled={customRunning}
                  className="flex-1 px-3 py-2 text-sm bg-bb-bg-primary border border-bb-border rounded-lg text-bb-text-primary placeholder:text-bb-text-muted focus:outline-none focus:border-bb-accent/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!customQuery.trim() || customRunning}
                  className="px-4 py-2 text-sm bg-bb-accent hover:bg-bb-accent-strong text-bb-bg-primary font-medium rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {customRunning ? (
                    <span className="inline-block w-3 h-3 border-2 border-bb-bg-primary/30 border-t-bb-bg-primary rounded-full animate-spin" />
                  ) : (
                    "Ask"
                  )}
                </button>
              </form>
            </div>

            {/* Reasoning Trace */}
            <div className="flex-1 p-4 rounded-2xl bg-bb-bg-secondary border border-bb-border min-h-[200px]">
              <h3 className="text-sm font-semibold text-bb-text-secondary mb-3">Graph traversal trace (simulated visualization)</h3>
              {customRunning && customTrace.length > 0 ? (
                <div className="space-y-3">
                  {customTrace.map((step, i) => (
                    <div key={i} className={`flex gap-3 transition-opacity duration-300 ${i < customTraceIdx ? "opacity-50" : i === customTraceIdx - 1 ? "opacity-100" : "opacity-0"}`}>
                      <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i < customTraceIdx - 1 ? "bg-bb-accent/20 text-bb-accent" : i === customTraceIdx - 1 ? "bg-bb-accent text-bb-bg-primary animate-pulse" : "bg-bb-bg-tertiary text-bb-text-muted"}`}>
                        {i < customTraceIdx - 1 ? "✓" : i + 1}
                      </div>
                      <p className="text-sm text-bb-text-secondary leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              ) : query ? (
                <div className="space-y-3">
                  {query.steps.map((step, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 transition-opacity duration-300 ${
                        i < currentStep ? "opacity-50" : i === currentStep ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i < currentStep
                          ? "bg-bb-accent/20 text-bb-accent"
                          : i === currentStep
                          ? "bg-bb-accent text-bb-bg-primary animate-pulse"
                          : "bg-bb-bg-tertiary text-bb-text-muted"
                      }`}>
                        {i < currentStep ? "✓" : i + 1}
                      </div>
                      <p className="text-sm text-bb-text-secondary leading-relaxed">
                        {i === currentStep ? typedText : step.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-bb-text-muted italic">
                  Select a query above to see the skills engine extract people, rules, and precedents from a public demo brain.
                </p>
              )}
            </div>

            {/* Skills File Output */}
            {showSkillsFile && (
              <div className="p-4 rounded-2xl bg-bb-bg-secondary border border-bb-accent/20 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-bb-accent text-lg">⚡</span>
                  <h3 className="text-sm font-semibold text-bb-accent">Generated Skills File</h3>
                </div>
                {skillsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-bb-text-muted py-4">
                    <span className="w-3 h-3 border-2 border-bb-accent/30 border-t-bb-accent rounded-full animate-spin" />
                    Generating from your brain...
                  </div>
                ) : skillsFile ? (
                  <>
                    <pre className="text-xs text-bb-text-secondary overflow-x-auto leading-relaxed bg-bb-bg-primary p-3 rounded-xl border border-bb-border">
                      <code>{JSON.stringify(skillsFile, null, 2)}</code>
                    </pre>
                    <p className="text-xs text-bb-text-muted mt-2">
                      Live output from public demo brain — powered by the real Brainbase skills engine, fully isolated from user data. No auth, no signup.
                    </p>
                  </>
                ) : (
                  <div className="text-xs text-bb-text-muted py-3">
                    <p>Demo brain returned no results for this query. Try "pricing exceptions" or "refund policy".</p>
                    <p className="mt-1">If the demo brain hasn't been seeded, run: npx tsx scripts/seed-demo-brain.ts</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-bb-border py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">How we built this</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-sm font-bold">01</span>
              </div>
              <h3 className="font-semibold mb-2">Ingest</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Connect Slack to extract entities, links, and decisions automatically.
                Additional integrations are on the roadmap.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-sm font-bold">02</span>
              </div>
              <h3 className="font-semibold mb-2">Structure</h3>
              <p className="text-sm text-bb-text-muted leading-relaxed">
                Typed pages, wikilinks, timeline entries, and embeddings build a
                queryable graph of how your company actually works.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-bb-bg-secondary border border-bb-border">
              <div className="w-10 h-10 rounded-lg bg-bb-accent-glow border border-bb-accent/20 flex items-center justify-center mb-4">
                <span className="text-bb-accent text-sm font-bold">03</span>
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

      {/* CTA */}
      <section className="border-t border-bb-border py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Build your company's brain</h2>
          <p className="text-bb-text-secondary mb-8">
            Stop letting your agents guess. Give them structured, attributed, confidence-scored knowledge.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/apply"
              className="w-full sm:w-auto px-6 py-3 bg-bb-accent hover:bg-bb-accent-dim text-bb-bg-primary font-medium rounded-xl transition-colors text-center"
            >
              Apply for early access
            </a>
            <a
              href="https://github.com/pkyanam/brainbase"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 border border-bb-border hover:border-bb-border-hover text-bb-text-secondary font-medium rounded-xl transition-colors text-center"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
