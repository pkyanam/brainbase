import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/skills/demo?task=<task>
 * Public demo endpoint — no auth required. Returns a realistic SkillsFile
 * generated from pre-seeded demo data so anyone can see the feature work.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const task = url.searchParams.get("task") || "";

  if (!task) {
    return NextResponse.json(
      { error: "Missing 'task' query parameter" },
      { status: 400 }
    );
  }

  const lower = task.toLowerCase();

  // Pricing exceptions demo
  if (lower.includes("pricing") || lower.includes("exception")) {
    return NextResponse.json({
      task: "pricing_exception",
      confidence: 0.94,
      sources: ["slack", "linear"],
      generatedAt: new Date().toISOString(),
      people: [
        { name: "Alice Chen", role: "Sales", involvement: "owner" as const, slackHandle: "@alice" },
        { name: "Bob Martinez", role: "Legal", involvement: "approver" as const, email: "bob@company.com" },
        { name: "Carol White", role: "Finance", involvement: "informed" as const },
      ],
      rules: [
        {
          condition: "deal_value < 50000",
          action: "Sales Manager approves directly",
          owner: "Alice Chen",
          precedents: 23,
          confidence: 0.97,
          sources: ["slack/pricing-decisions/march-2026"],
        },
        {
          condition: "deal_value >= 100000",
          action: "Requires Legal review + escalation to VP",
          owner: "Bob Martinez",
          precedents: 8,
          confidence: 0.91,
          sources: ["slack/pricing-decisions/april-2026", "linear/LEGAL-42"],
        },
      ],
      implicitRules: [
        {
          observation: "$100K threshold was never formally documented but enforced in every precedent",
          evidence: "8 decisions over $100K all required Legal; no written policy found",
          confidence: 0.89,
        },
        {
          observation: "No documented process for deals between $50K and $100K",
          evidence: "Gap in documented thresholds — 0 precedents in this range",
          confidence: 0.75,
        },
      ],
      precedents: [
        { date: "2026-03-15", summary: "Acme Corp $45K deal — Alice approved same day", outcome: "Approved", confidence: 0.95 },
        { date: "2026-03-22", summary: "Beta Inc $120K deal — escalated to Bob, VP sign-off required", outcome: "Escalated", confidence: 0.92 },
        { date: "2026-04-01", summary: "Gamma LLC $38K deal — standard Sales approval", outcome: "Approved", confidence: 0.94 },
        { date: "2026-04-10", summary: "Delta Co $150K deal — Legal review + Finance check", outcome: "Approved", confidence: 0.88 },
      ],
      exceptions: [
        { condition: "Enterprise tier customers", handling: "May bypass standard process with VP approval", source: "slack/pricing-decisions/april-2026" },
      ],
    });
  }

  // Refund policy demo
  if (lower.includes("refund")) {
    return NextResponse.json({
      task: "refund_request",
      confidence: 0.89,
      sources: ["slack", "docs"],
      generatedAt: new Date().toISOString(),
      people: [
        { name: "Carol White", role: "Finance", involvement: "owner" as const, email: "carol@company.com" },
        { name: "Customer Success Team", role: "Customer Success", involvement: "informed" as const },
      ],
      rules: [
        {
          condition: "standard_refund",
          action: "Customer Success handles initial triage",
          owner: "Customer Success Team",
          precedents: 45,
          confidence: 0.95,
          sources: ["docs/refund-policy"],
        },
        {
          condition: "partial_refund_over_10k",
          action: "Finance team must approve",
          owner: "Carol White",
          precedents: 12,
          confidence: 0.88,
          sources: ["slack/refunds/q1-2026"],
        },
      ],
      implicitRules: [
        {
          observation: "Refunds over $25K always require Carol's direct sign-off despite policy saying $10K",
          evidence: "12 of 12 large refunds had Carol involved; policy only mentions $10K threshold",
          confidence: 0.82,
        },
      ],
      precedents: [
        { date: "2026-01-10", summary: "Standard $200 refund — CS approved", outcome: "Approved", confidence: 0.96 },
        { date: "2026-02-05", summary: "$15K partial refund — Carol approved after review", outcome: "Approved", confidence: 0.90 },
        { date: "2026-03-18", summary: "$30K refund request — escalated to Carol + VP", outcome: "Approved", confidence: 0.85 },
      ],
      exceptions: [
        { condition: "Annual plan cancellations within 30 days", handling: "Full refund, no questions asked", source: "docs/refund-policy" },
      ],
    });
  }

  // Generic fallback
  return NextResponse.json({
    task,
    confidence: 0.0,
    sources: [],
    generatedAt: new Date().toISOString(),
    people: [],
    rules: [],
    implicitRules: [],
    precedents: [],
    exceptions: [],
  });
}
