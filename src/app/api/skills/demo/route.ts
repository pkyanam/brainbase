import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/skills/demo?task=<task>
 *
 * Public demo endpoint — no auth required. Returns pre-generated demo output.
 *
 * NOTE: Temporarily using static data while we debug a searchBrain
 * cross-brain contamination bug that leaked real contact data when
 * querying for names that exist in both the demo brain and real brains.
 */
const DEMO_RESPONSES: Record<string, unknown> = {
  "pricing exceptions": {
    task: "pricing exceptions",
    confidence: 0.94,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [
      { name: "Alice Chen", role: "Sales", involvement: "owner", slackHandle: "@alice" },
      { name: "Bob Martinez", role: "Legal", involvement: "approver", email: "bob@company.com" },
      { name: "Carol White", role: "Finance", involvement: "informed" },
    ],
    rules: [
      { condition: "deal_value < 50000", action: "Sales Manager approves directly", owner: "Alice Chen", precedents: 23, confidence: 0.97, sources: ["pricing-exceptions"] },
      { condition: "deal_value >= 100000", action: "Requires Legal review + escalation to VP", owner: "Bob Martinez", precedents: 8, confidence: 0.91, sources: ["pricing-exceptions"] },
    ],
    implicitRules: [
      { observation: "$100K threshold was never formally documented but enforced in every precedent", evidence: "8 decisions over $100K all required Legal; no written policy found", confidence: 0.89 },
      { observation: "No documented process for deals between $50K and $100K", evidence: "Gap in documented thresholds — 0 precedents in this range", confidence: 0.75 },
    ],
    precedents: [
      { date: "2026-03-15", summary: "Acme Corp $45K deal — Alice approved same day", outcome: "Approved", confidence: 0.95 },
      { date: "2026-03-22", summary: "Beta Inc $120K deal — escalated to Bob, VP sign-off required", outcome: "Escalated", confidence: 0.92 },
      { date: "2026-04-01", summary: "Gamma LLC $38K deal — standard Sales approval", outcome: "Approved", confidence: 0.94 },
      { date: "2026-04-10", summary: "Delta Co $150K deal — Legal review + Finance check", outcome: "Approved", confidence: 0.88 },
    ],
    exceptions: [
      { condition: "Enterprise tier customers", handling: "May bypass standard process with VP approval", source: "enterprise-tier" },
    ],
  },
  "refund policy": {
    task: "refund policy",
    confidence: 0.89,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [
      { name: "Carol White", role: "Finance", involvement: "owner", email: "carol@company.com" },
      { name: "Customer Success Team", role: "Customer Success", involvement: "informed" },
    ],
    rules: [
      { condition: "standard_refund", action: "Customer Success handles initial triage", owner: "Customer Success Team", precedents: 45, confidence: 0.95, sources: ["refund-policy"] },
      { condition: "partial_refund_over_10k", action: "Finance team must approve", owner: "Carol White", precedents: 12, confidence: 0.88, sources: ["refund-policy"] },
    ],
    implicitRules: [
      { observation: "Refunds over $25K always require Carol's direct sign-off despite policy saying $10K", evidence: "12 of 12 large refunds had Carol involved; policy only mentions $10K threshold", confidence: 0.82 },
    ],
    precedents: [
      { date: "2026-01-10", summary: "Standard $200 refund — CS approved", outcome: "Approved", confidence: 0.96 },
      { date: "2026-02-05", summary: "$15K partial refund — Carol approved after review", outcome: "Approved", confidence: 0.90 },
      { date: "2026-03-18", summary: "$30K refund request — escalated to Carol + VP", outcome: "Approved", confidence: 0.85 },
    ],
    exceptions: [
      { condition: "Annual plan cancellations within 30 days", handling: "Full refund, no questions asked", source: "refund-policy" },
    ],
  },
  "bob martinez": {
    task: "bob martinez",
    confidence: 0.88,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [
      { name: "Bob Martinez", role: "Legal", involvement: "approver", email: "bob@company.com" },
    ],
    rules: [
      { condition: "deal_value >= 100000", action: "Requires Legal review by Bob Martinez + escalation to VP", owner: "Bob Martinez", precedents: 8, confidence: 0.91, sources: ["pricing-exceptions"] },
      { condition: "legal_review", action: "Bob reviews all pricing exceptions over $100K threshold", owner: "Bob Martinez", precedents: 8, confidence: 0.88, sources: ["bob-martinez"] },
    ],
    implicitRules: [],
    precedents: [],
    exceptions: [],
  },
  "alice chen": {
    task: "alice chen",
    confidence: 0.92,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [
      { name: "Alice Chen", role: "Sales", involvement: "owner", slackHandle: "@alice" },
    ],
    rules: [
      { condition: "deal_value < 50000", action: "Alice Chen approves directly as Sales Manager", owner: "Alice Chen", precedents: 23, confidence: 0.97, sources: ["pricing-exceptions"] },
    ],
    implicitRules: [],
    precedents: [],
    exceptions: [],
  },
  "enterprise tier": {
    task: "enterprise tier",
    confidence: 0.85,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [],
    rules: [
      { condition: "enterprise_customer", action: "May bypass standard pricing exception process with VP approval", precedents: 3, confidence: 0.80, sources: ["enterprise-tier"] },
    ],
    implicitRules: [],
    precedents: [],
    exceptions: [
      { condition: "Enterprise tier customers", handling: "May bypass standard process with VP approval", source: "enterprise-tier" },
    ],
  },
  "carol white": {
    task: "carol white",
    confidence: 0.87,
    sources: ["demo-brain"],
    generatedAt: new Date().toISOString(),
    people: [
      { name: "Carol White", role: "Finance", involvement: "owner", email: "carol@company.com" },
    ],
    rules: [
      { condition: "refund_over_10k", action: "Carol White must approve all partial refunds over $10K", owner: "Carol White", precedents: 12, confidence: 0.88, sources: ["refund-policy"] },
      { condition: "refund_over_25k", action: "Carol's direct sign-off required (unwritten rule above $10K policy)", owner: "Carol White", precedents: 3, confidence: 0.82, sources: ["refund-policy"] },
    ],
    implicitRules: [
      { observation: "Every refund over $25K required Carol's sign-off despite policy stating $10K", evidence: "12 large refunds processed, 3 over $25K all escalated", confidence: 0.82 },
    ],
    precedents: [],
    exceptions: [],
  },
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const task = url.searchParams.get("task") || "";

  if (!task) {
    return NextResponse.json(
      { error: "Missing 'task' query parameter. Try ?task=pricing+exceptions" },
      { status: 400 }
    );
  }

  const lower = task.toLowerCase();

  // Exact match first
  const match = DEMO_RESPONSES[lower];
  if (match) {
    return NextResponse.json({ ...(match as Record<string, unknown>), generatedAt: new Date().toISOString() });
  }

  // Fuzzy match
  for (const [key, value] of Object.entries(DEMO_RESPONSES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return NextResponse.json({ ...(value as Record<string, unknown>), generatedAt: new Date().toISOString() });
    }
  }

  // Fallback for unrecognized queries
  return NextResponse.json({
    task,
    confidence: 0,
    sources: [],
    generatedAt: new Date().toISOString(),
    people: [],
    rules: [],
    implicitRules: [],
    precedents: [],
    exceptions: [],
    _note: `Demo brain covers: ${Object.keys(DEMO_RESPONSES).join(", ")}. The live engine is temporarily disabled while we fix a search scope bug.`,
  });
}
