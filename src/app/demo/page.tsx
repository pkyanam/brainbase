"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

/* ─── Demo Data: Simulated Company Brain ───────────────── */

interface DemoNode {
  id: string;
  label: string;
  type: string;
  linkCount: number;
}

interface DemoEdge {
  source: string;
  target: string;
  type: string;
}

const DEMO_NODES: DemoNode[] = [
  { id: "pricing-exceptions", label: "Pricing Exceptions", type: "concept", linkCount: 8 },
  { id: "alice-chen", label: "Alice Chen", type: "person", linkCount: 6 },
  { id: "bob-martinez", label: "Bob Martinez", type: "person", linkCount: 5 },
  { id: "legal-review", label: "Legal Review", type: "concept", linkCount: 4 },
  { id: "sales-manager", label: "Sales Manager", type: "concept", linkCount: 4 },
  { id: "deal-value-50k", label: "Deal < $50K", type: "concept", linkCount: 3 },
  { id: "deal-value-100k", label: "Deal ≥ $100K", type: "concept", linkCount: 4 },
  { id: "escalation-process", label: "Escalation Process", type: "concept", linkCount: 3 },
  { id: "refund-policy", label: "Refund Policy", type: "concept", linkCount: 5 },
  { id: "carol-white", label: "Carol White", type: "person", linkCount: 4 },
  { id: "finance-team", label: "Finance Team", type: "concept", linkCount: 3 },
  { id: "enterprise-tier", label: "Enterprise Tier", type: "concept", linkCount: 3 },
  { id: "customer-success", label: "Customer Success", type: "concept", linkCount: 3 },
  { id: "march-2026", label: "March 2026", type: "concept", linkCount: 2 },
  { id: "april-2026", label: "April 2026", type: "concept", linkCount: 3 },
  { id: "slack-decision-1", label: "Slack: Pricing Exception #1", type: "concept", linkCount: 2 },
  { id: "slack-decision-2", label: "Slack: Pricing Exception #2", type: "concept", linkCount: 2 },
  { id: "unwritten-rule", label: "Unwritten Rule", type: "concept", linkCount: 2 },
  { id: "stripe", label: "Stripe", type: "company", linkCount: 2 },
  { id: "invoice-process", label: "Invoice Process", type: "concept", linkCount: 2 },
];

const DEMO_EDGES: DemoEdge[] = [
  { source: "pricing-exceptions", target: "alice-chen", type: "involves" },
  { source: "pricing-exceptions", target: "bob-martinez", type: "involves" },
  { source: "pricing-exceptions", target: "legal-review", type: "requires" },
  { source: "pricing-exceptions", target: "sales-manager", type: "owned_by" },
  { source: "pricing-exceptions", target: "deal-value-50k", type: "condition" },
  { source: "pricing-exceptions", target: "deal-value-100k", type: "condition" },
  { source: "pricing-exceptions", target: "escalation-process", type: "triggers" },
  { source: "deal-value-50k", target: "sales-manager", type: "approved_by" },
  { source: "deal-value-100k", target: "legal-review", type: "approved_by" },
  { source: "deal-value-100k", target: "escalation-process", type: "triggers" },
  { source: "refund-policy", target: "carol-white", type: "involves" },
  { source: "refund-policy", target: "finance-team", type: "owned_by" },
  { source: "refund-policy", target: "customer-success", type: "handled_by" },
  { source: "alice-chen", target: "sales-manager", type: "role" },
  { source: "bob-martinez", target: "legal-review", type: "role" },
  { source: "carol-white", target: "finance-team", type: "role" },
  { source: "enterprise-tier", target: "pricing-exceptions", type: "related_to" },
  { source: "enterprise-tier", target: "sales-manager", type: "owned_by" },
  { source: "slack-decision-1", target: "pricing-exceptions", type: "about" },
  { source: "slack-decision-1", target: "alice-chen", type: "authored_by" },
  { source: "slack-decision-1", target: "march-2026", type: "date" },
  { source: "slack-decision-2", target: "pricing-exceptions", type: "about" },
  { source: "slack-decision-2", target: "bob-martinez", type: "authored_by" },
  { source: "slack-decision-2", target: "april-2026", type: "date" },
  { source: "unwritten-rule", target: "pricing-exceptions", type: "governs" },
  { source: "unwritten-rule", target: "deal-value-100k", type: "applies_to" },
  { source: "stripe", target: "invoice-process", type: "uses" },
  { source: "invoice-process", target: "finance-team", type: "owned_by" },
];

/* ─── 3D Brain Visualization (simplified for demo) ─────── */

const TYPE_COLORS: Record<string, string> = {
  person: "#e8927c",
  concept: "#7dd3a8",
  company: "#8ec5e8",
};
const EDGE_COLOR = "#4a7e5c";

function computeLayout(nodes: DemoNode[], edges: DemoEdge[]) {
  const positions = new Map<string, THREE.Vector3>();
  for (const n of nodes) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r = 3 + Math.random() * 2;
    positions.set(n.id, new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ));
  }
  for (let iter = 0; iter < 20; iter++) {
    const forces = new Map<string, THREE.Vector3>();
    for (const n of nodes) forces.set(n.id, new THREE.Vector3());
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id)!, b = positions.get(nodes[j].id)!;
        const dir = new THREE.Vector3().subVectors(a, b);
        const d = dir.length() + 0.1;
        dir.normalize().multiplyScalar(0.03 / (d * d));
        forces.get(nodes[i].id)!.add(dir);
        forces.get(nodes[j].id)!.sub(dir);
      }
    }
    for (const e of edges) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      const dir = new THREE.Vector3().subVectors(b, a);
      dir.normalize().multiplyScalar(0.004 * dir.length());
      forces.get(e.source)!.add(dir);
      forces.get(e.target)!.sub(dir);
    }
    for (const n of nodes) {
      const p = positions.get(n.id)!;
      p.add(forces.get(n.id)!.multiplyScalar(0.7));
      p.clampLength(2, 8);
    }
  }
  return positions;
}

function DemoScene({ activeNodes, activeEdges }: { activeNodes: Set<string>; activeEdges: Set<string> }) {
  const positions = useMemo(() => computeLayout(DEMO_NODES, DEMO_EDGES), []);

  const { pointPositions, pointColors, pointSizes } = useMemo(() => {
    const verts: number[] = [], colors: number[] = [], sizes: number[] = [];
    for (const n of DEMO_NODES) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      verts.push(pos.x, pos.y, pos.z);
      const hex = TYPE_COLORS[n.type] || "#7dd3a8";
      const c = new THREE.Color(hex);
      if (activeNodes.has(n.id)) {
        c.multiplyScalar(1.5);
      } else if (activeNodes.size > 0) {
        c.multiplyScalar(0.3);
      }
      colors.push(c.r, c.g, c.b);
      const size = activeNodes.has(n.id) ? 0.5 : 0.28;
      sizes.push(size);
    }
    return { pointPositions: new Float32Array(verts), pointColors: new Float32Array(colors), pointSizes: new Float32Array(sizes) };
  }, [positions, activeNodes]);

  const edgeVerts = useMemo(() => {
    const verts: number[] = [];
    for (const e of DEMO_EDGES) {
      const a = positions.get(e.source), b = positions.get(e.target);
      if (!a || !b) continue;
      const isActive = activeEdges.has(`${e.source}-${e.target}`) || activeEdges.has(`${e.target}-${e.source}`);
      if (activeEdges.size > 0 && !isActive) continue;
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    return new Float32Array(verts);
  }, [positions, activeEdges]);

  const pointGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const edgeGeo = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => {
    pointGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
    pointGeo.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));
    pointGeo.setAttribute("size", new THREE.Float32BufferAttribute(pointSizes, 1));
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeVerts, 3));
  }, [pointPositions, pointColors, pointSizes, edgeVerts, pointGeo, edgeGeo]);

  return (
    <>
      <fog attach="fog" args={["#0a0a0a", 6, 16]} />
      <ambientLight intensity={0.6} />
      <Stars radius={40} depth={30} count={600} factor={3} fade speed={0.5} />

      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={activeEdges.size > 0 ? 0.8 : 0.4} />
      </lineSegments>

      <points geometry={pointGeo}>
        <pointsMaterial size={0.35} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>

      {DEMO_NODES.filter(n => n.linkCount >= 3).map(n => {
        const pos = positions.get(n.id);
        if (!pos) return null;
        const label = n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label;
        const isActive = activeNodes.has(n.id);
        return (
          <Billboard key={n.id} position={[pos.x, pos.y + 0.4, pos.z]}>
            <Text
              fontSize={isActive ? 0.28 : 0.2}
              color={isActive ? "#7dd3a8" : "#888888"}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.02}
              outlineColor="#0a0a0a"
            >
              {label}
            </Text>
          </Billboard>
        );
      })}

      <OrbitControls enableDamping dampingFactor={0.06} minDistance={3} maxDistance={14} autoRotate autoRotateSpeed={0.2} />
    </>
  );
}

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
            See how AI agents{" "}
            <span className="bg-gradient-to-r from-bb-accent to-bb-accent-dim bg-clip-text text-transparent">
              reason with company knowledge
            </span>
          </h1>
          <p className="text-lg text-bb-text-secondary max-w-2xl mx-auto">
            Brainbase turns scattered Slack threads and docs into a structured knowledge graph.
            Watch an AI agent traverse it in real-time.
          </p>
        </div>
      </section>

      {/* Demo Interface */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: 3D Brain */}
          <div className="lg:col-span-3 h-[500px] rounded-2xl border border-bb-border overflow-hidden relative">
            <Canvas
              camera={{ position: [0, 2, 8], fov: 55 }}
              style={{ background: "#0a0a0a" }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, powerPreference: "low-power" }}
            >
              <DemoScene activeNodes={activeNodes} activeEdges={activeEdges} />
            </Canvas>
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
            </div>

            {/* Reasoning Trace */}
            <div className="flex-1 p-4 rounded-2xl bg-bb-bg-secondary border border-bb-border min-h-[200px]">
              <h3 className="text-sm font-semibold text-bb-text-secondary mb-3">Agent reasoning trace</h3>
              {query ? (
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
                  Select a query above to watch the agent reason through your company's brain.
                </p>
              )}
            </div>

            {/* Skills File Output */}
            {showSkillsFile && query && (
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
                      Live output from GET /api/skills/demo — no auth, no signup required.
                    </p>
                  </>
                ) : (
                  <div className="text-xs text-bb-text-muted py-3">
                    <p>Task not recognized in demo dataset. Try "pricing exceptions" or "refund policy".</p>
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
