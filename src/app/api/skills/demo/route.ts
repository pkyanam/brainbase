import { NextRequest, NextResponse } from "next/server";
import { generateSkillsFile } from "@/lib/skills-generator";
import { queryOne, query } from "@/lib/supabase/client";

/**
 * GET /api/skills/demo?task=<task>
 *
 * Public demo endpoint — no auth required. Queries a pre-seeded public
 * demo brain using the real skills generator (same code that powers the
 * authenticated /api/skills endpoint).
 *
 * The demo brain auto-seeds on first access with synthetic company data
 * (pricing exceptions, refund policies, etc.). No signup needed.
 */
const DEMO_BRAIN_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_OWNER_ID = "demo-system";
let seeded = false;

async function ensureDemoBrainSeeded() {
  if (seeded) return;

  // Check if demo brain already exists
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM brains WHERE id = $1 LIMIT 1`,
    [DEMO_BRAIN_ID]
  );

  if (existing) {
    // Verify it has pages (might have been created but not seeded)
    const pageCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM pages WHERE brain_id = $1`,
      [DEMO_BRAIN_ID]
    );
    if (pageCount && parseInt(pageCount.count) > 0) {
      seeded = true;
      console.log(`[brainbase] Demo brain already seeded — ${pageCount.count} pages`);
      return;
    }
  }

  console.log("[brainbase] 🌱 Seeding demo brain...");

  // Create demo brain
  await query(
    `INSERT INTO brains (id, owner_user_id, name, slug)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = $3, slug = $4`,
    [DEMO_BRAIN_ID, DEMO_OWNER_ID, "Demo Brain", "demo"]
  );

  // Seed pages
  const pages = [
    {
      slug: "pricing-exceptions", title: "Pricing Exceptions", type: "concept",
      content: `# Pricing Exceptions

> Process for handling non-standard pricing requests.

## Policy
- If deal value is under $50,000, Sales Manager approves directly.
- If deal value is $100,000 or above, requires Legal review and escalation to VP.
- No documented process for deals between $50K and $100K — this is a known gap.

## People Involved
- Alice Chen owns the standard approval process for deals under $50K.
- Bob Martinez handles Legal review for deals over the $100K threshold.
- Carol White in Finance is informed for all escalated pricing decisions.

## Exceptions
- Enterprise tier customers may bypass standard process with VP approval.

## Precedent Summary
23 pricing exceptions processed since March 2026. All 8 deals over $100K went through Legal — the $100K threshold was never formally documented but enforced in every case.`,
    },
    {
      slug: "alice-chen", title: "Alice Chen", type: "person",
      content: `# Alice Chen

## State
- **Role:** Sales Manager
- **Team:** Enterprise Sales
- **Slack:** @alice
- **Location:** San Francisco

## What They Do
Alice owns the standard pricing exception process. She approves all deal-level discounts under $50,000 directly. For larger deals, she initiates the escalation workflow to Legal.

## Relationship
Primary point of contact for any pricing-related questions. 23 precedents of direct approvals in Q1 2026.`,
    },
    {
      slug: "bob-martinez", title: "Bob Martinez", type: "person",
      content: `# Bob Martinez

## State
- **Role:** Legal Counsel
- **Team:** Legal & Compliance
- **Email:** bob@company.com
- **Location:** New York

## What They Do
Bob reviews all deals over the $100K threshold. He determines whether the pricing exception requires VP escalation. He is the gatekeeper for enterprise-tier pricing deviations.

## Relationship
8 escalations reviewed by Bob in Q1 2026. Every deal over $100K required his signoff — the threshold was never formally documented but consistently enforced.`,
    },
    {
      slug: "carol-white", title: "Carol White", type: "person",
      content: `# Carol White

## State
- **Role:** Finance Manager
- **Team:** Finance
- **Email:** carol@company.com
- **Location:** Chicago

## What They Do
Carol handles all refund-related approvals over $10,000. She is also informed on all escalated pricing decisions. Despite policy stating $10K, every refund over $25K has required Carol's direct sign-off.

## Relationship
Finance approver for large transactions. 12 large refunds processed in Q1 2026, all with Carol involved.`,
    },
    {
      slug: "refund-policy", title: "Refund Policy", type: "concept",
      content: `# Refund Policy

> Standard refunds are handled by Customer Success. Larger refunds require Finance approval.

## Policy
- Standard refunds under $10,000: Customer Success handles initial triage and approval.
- Partial refunds over $10,000: Finance team must approve. Carol White is the owner.
- Annual plan cancellations within 30 days: Full refund, no questions asked.

## Exceptions
- If refund is over $25,000, Carol's direct sign-off is required despite policy stating $10K threshold.
- Enterprise customers on annual contracts may negotiate custom refund terms.

## Precedent Summary
45 standard refunds processed by CS in Q1 2026. 12 large refunds ($10K+) all required Carol's approval. 3 refunds over $25K were escalated to VP as well.`,
    },
    {
      slug: "enterprise-tier", title: "Enterprise Tier", type: "concept",
      content: `# Enterprise Tier

## State
- **Pricing:** Custom, typically $50K+ annually
- **Key Features:** SSO, audit logs, dedicated support, SLA

## Special Handling
Enterprise tier customers may bypass the standard pricing exception process with VP approval. This override applies to renewals, expansions, and custom feature requests.

## Relationship
Linked to Pricing Exceptions and Sales Manager workflows.`,
    },
    {
      slug: "customer-success", title: "Customer Success Team", type: "concept",
      content: `# Customer Success Team

## Role
First line of defense for customer issues including refund requests, billing questions, and account changes.

## Refund Process
CS handles initial triage for all refund requests. Standard refunds (under $10K) can be approved directly by CS. Larger refunds are routed to Finance for Carol White's review.

## Team Members
- Rotating team of 6 CS reps
- Escalation path: CS → Finance (Carol White) → VP`,
    },
  ];

  for (const page of pages) {
    await query(
      `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, search_vector, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, to_tsvector('english', $5), NOW(), NOW())
       ON CONFLICT (brain_id, slug) DO UPDATE
       SET title = $3, type = $4, compiled_truth = $5, search_vector = to_tsvector('english', $5), updated_at = NOW()`,
      [DEMO_BRAIN_ID, page.slug, page.title, page.type, page.content]
    );
  }

  // Seed links
  const links = [
    ["pricing-exceptions", "alice-chen", "involves"],
    ["pricing-exceptions", "bob-martinez", "involves"],
    ["pricing-exceptions", "carol-white", "involves"],
    ["pricing-exceptions", "enterprise-tier", "related_to"],
    ["alice-chen", "pricing-exceptions", "works_on"],
    ["bob-martinez", "pricing-exceptions", "works_on"],
    ["refund-policy", "carol-white", "involves"],
    ["refund-policy", "customer-success", "handled_by"],
    ["carol-white", "refund-policy", "works_on"],
    ["enterprise-tier", "pricing-exceptions", "has_override"],
  ];

  for (const [from, to, type] of links) {
    await query(
      `INSERT INTO links (brain_id, from_slug, to_slug, link_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [DEMO_BRAIN_ID, from, to, type]
    );
  }

  // Seed timeline entries (precedents)
  const timeline = [
    { slug: "pricing-exceptions", date: "2026-03-15", summary: "Acme Corp $45K deal — Alice approved same day under standard process", source: "slack/pricing-decisions/march-2026" },
    { slug: "pricing-exceptions", date: "2026-03-22", summary: "Beta Inc $120K deal — escalated to Bob for Legal review, VP sign-off required", source: "slack/pricing-decisions/march-2026" },
    { slug: "pricing-exceptions", date: "2026-04-01", summary: "Gamma LLC $38K deal — standard Sales Manager approval by Alice", source: "slack/pricing-decisions/april-2026" },
    { slug: "pricing-exceptions", date: "2026-04-10", summary: "Delta Co $150K deal — Legal review by Bob + Finance check by Carol, approved after escalation", source: "slack/pricing-decisions/april-2026" },
    { slug: "pricing-exceptions", date: "2026-04-22", summary: "Epsilon Inc $75K deal — fell in undocumented gap between $50K-$100K, handled ad-hoc by Alice", source: "slack/pricing-decisions/april-2026" },
    { slug: "refund-policy", date: "2026-01-10", summary: "Standard $200 refund — CS approved same day", source: "slack/refunds/q1-2026" },
    { slug: "refund-policy", date: "2026-02-05", summary: "$15K partial refund — Carol approved after Finance review", source: "slack/refunds/q1-2026" },
    { slug: "refund-policy", date: "2026-03-18", summary: "$30K refund request — escalated to Carol + VP, approved with conditions", source: "slack/refunds/q1-2026" },
    { slug: "refund-policy", date: "2026-04-05", summary: "Enterprise customer annual refund — full refund within 30-day window, no questions asked", source: "docs/refund-policy" },
  ];

  for (const t of timeline) {
    await query(
      `INSERT INTO timeline_entries (brain_id, page_slug, date, summary, source, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [DEMO_BRAIN_ID, t.slug, t.date, t.summary, t.source]
    );
  }

  seeded = true;
  console.log(`[brainbase] ✅ Demo brain seeded — ${pages.length} pages, ${links.length} links, ${timeline.length} timeline entries`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const task = url.searchParams.get("task") || "";

  if (!task) {
    return NextResponse.json(
      { error: "Missing 'task' query parameter. Try ?task=pricing+exceptions" },
      { status: 400 }
    );
  }

  try {
    await ensureDemoBrainSeeded();

    const skillsFile = await generateSkillsFile(DEMO_BRAIN_ID, task);

    // If the demo brain hasn't been seeded yet, surface a helpful message
    if (skillsFile.confidence === 0 && skillsFile.people.length === 0 && skillsFile.rules.length === 0) {
      return NextResponse.json({
        ...skillsFile,
        _note: "No matching pages found in demo brain. Try 'pricing exceptions' or 'refund policy'.",
      });
    }

    return NextResponse.json(skillsFile);
  } catch (err) {
    console.error("[brainbase] Demo skills generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate skills file from demo brain" },
      { status: 500 }
    );
  }
}
