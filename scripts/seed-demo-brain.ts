/**
 * Seed a public demo brain for the interactive demo page.
 * Creates the demo brain with a fixed UUID and populates it with
 * realistic page data that the skills generator can extract from.
 *
 * Run: npx tsx scripts/seed-demo-brain.ts
 *
 * The demo brain is read-only for the public demo endpoint — no auth,
 * no signup required. All data is synthetic.
 */

import { Pool } from "pg";

const DEMO_BRAIN_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_OWNER_ID = "demo-system";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "",
  max: 5,
  idleTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log("🌱 Seeding demo brain...\n");

  // ── 1. Create demo brain ─────────────────────────────────────
  await pool.query(
    `INSERT INTO brains (id, owner_user_id, name, slug)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = $3, slug = $4`,
    [DEMO_BRAIN_ID, DEMO_OWNER_ID, "Demo Brain", "demo"]
  );
  console.log("✅ Demo brain created");

  // ── 2. Insert pages ──────────────────────────────────────────

  const pages = [
    {
      slug: "pricing-exceptions",
      title: "Pricing Exceptions",
      type: "concept",
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
      slug: "alice-chen",
      title: "Alice Chen",
      type: "person",
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
      slug: "bob-martinez",
      title: "Bob Martinez",
      type: "person",
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
      slug: "carol-white",
      title: "Carol White",
      type: "person",
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
      slug: "refund-policy",
      title: "Refund Policy",
      type: "concept",
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
      slug: "enterprise-tier",
      title: "Enterprise Tier",
      type: "concept",
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
      slug: "customer-success",
      title: "Customer Success",
      type: "concept",
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
    await pool.query(
      `INSERT INTO pages (brain_id, slug, title, type, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (brain_id, slug) DO UPDATE
       SET title = $3, type = $4, content = $5, updated_at = NOW()`,
      [DEMO_BRAIN_ID, page.slug, page.title, page.type, page.content]
    );
    console.log(`  📄 ${page.slug} (${page.type})`);
  }

  // ── 3. Create links ──────────────────────────────────────────

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
    await pool.query(
      `INSERT INTO links (brain_id, from_slug, to_slug, link_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [DEMO_BRAIN_ID, from, to, type]
    );
    console.log(`  🔗 ${from} → ${to} (${type})`);
  }

  // ── 4. Create timeline entries (precedents) ───────────────────

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
    await pool.query(
      `INSERT INTO timeline_entries (brain_id, page_slug, date, summary, source, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [DEMO_BRAIN_ID, t.slug, t.date, t.summary, t.source]
    );
    console.log(`  📅 ${t.slug}: ${t.date} — ${t.summary.slice(0, 60)}...`);
  }

  // ── 5. Create content chunks for FTS + vector search ───────────

  for (const page of pages) {
    // Create 2-3 chunks per page for search coverage
    const chunks = [
      { text: page.title, index: 0 },
      { text: page.content.slice(0, 500), index: 1 },
      { text: page.content.slice(500, 1000), index: 2 },
    ].filter(c => c.text.trim());

    for (const chunk of chunks) {
      await pool.query(
        `INSERT INTO content_chunks (brain_id, page_slug, chunk_index, content, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [DEMO_BRAIN_ID, page.slug, chunk.index, chunk.text]
      );
    }
  }
  console.log(`\n📦 Content chunks created for all pages`);

  console.log(`\n✅ Demo brain seeded successfully!`);
  console.log(`   Brain ID: ${DEMO_BRAIN_ID}`);
  console.log(`   Pages: ${pages.length}`);
  console.log(`   Links: ${links.length}`);
  console.log(`   Timeline entries: ${timeline.length}`);
  console.log(`\n   Demo endpoint: GET /api/skills/demo?task=pricing+exceptions`);
  console.log(`   Demo endpoint: GET /api/skills/demo?task=refund+policy`);

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
