/**
 * Seed a demo brain with realistic SaaS company data.
 * Run: npx tsx scripts/seed-demo-brain.ts
 */
import { query, queryOne } from "../src/lib/supabase/client";

const BRAIN_ID = "00000000-0000-0000-0000-000000000001";

interface PageDraft {
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

const people: PageDraft[] = [
  {
    slug: "people/alice-chen",
    title: "Alice Chen",
    type: "person",
    content: `# Alice Chen

Sales Lead at Acme SaaS.

- **Role:** Sales Lead
- **Slack:** @alice
- **Email:** alice@acme.com
- **Handles:** Deals under $50K, initial outreach, demo calls.
- **Reports to:** Sales Manager

## Decisions
- Approved 23 pricing exceptions under $50K in Q1 2026.
- Flagged that deals above $500K always seem to involve the CEO informally.`,
  },
  {
    slug: "people/bob-martinez",
    title: "Bob Martinez",
    type: "person",
    content: `# Bob Martinez

Legal Counsel at Acme SaaS.

- **Role:** Legal Counsel
- **Slack:** @bob
- **Email:** bob@acme.com
- **Handles:** Contract review, pricing exceptions over $100K, vendor agreements.

## Notes
- Requires 48h turnaround for contracts over $100K.
- Has never documented the $100K threshold formally — it just "evolved."`,
  },
  {
    slug: "people/carol-white",
    title: "Carol White",
    type: "person",
    content: `# Carol White

Finance Manager at Acme SaaS.

- **Role:** Finance Manager
- **Slack:** @carol
- **Email:** carol@acme.com
- **Handles:** Refund approvals over $10K, invoice disputes, annual contract billing.

## Patterns
- Always gets looped in on refunds over $25K even though policy says $10K.
- Has approved 12 partial refunds over $10K since Jan 2026.`,
  },
  {
    slug: "people/david-kim",
    title: "David Kim",
    type: "person",
    content: `# David Kim

CTO at Acme SaaS.

- **Role:** CTO
- **Slack:** @david
- **Email:** david@acme.com
- **Handles:** Engineering, incident escalation, infrastructure decisions.

## Escalation Pattern
- Gets paged automatically if a customer with >$500K ARR has an incident.
- This was never written down — started after the MegaCorp outage in Feb 2026.`,
  },
  {
    slug: "people/eve-rodriguez",
    title: "Eve Rodriguez",
    type: "person",
    content: `# Eve Rodriguez

Customer Success Lead at Acme SaaS.

- **Role:** Customer Success Lead
- **Slack:** @eve
- **Email:** eve@acme.com
- **Handles:** Refund triage, customer complaints, onboarding issues.

## Notes
- Handles all standard refunds under $10K.
- Escalates to Carol for anything larger.`,
  },
];

const policies: PageDraft[] = [
  {
    slug: "policies/pricing-exceptions",
    title: "Pricing Exceptions",
    type: "policy",
    content: `# Pricing Exceptions

## Overview
Non-standard pricing requires approval based on deal size.

## Rules
- If deal value < $50K, Sales Manager can approve directly.
- If deal value >= $100K, requires Legal review and escalation.

## People
- [[people/alice-chen]] — Sales Lead
- [[people/bob-martinez]] — Legal Counsel

## Exceptions
- Enterprise tier customers may bypass standard process with VP approval.`,
  },
  {
    slug: "policies/refund-policy",
    title: "Refund Policy",
    type: "policy",
    content: `# Refund Policy

## Standard Refunds
- Customer Success handles initial triage.
- Full refund within 30 days for annual plans.

## Large Refunds
- Partial refunds over $10K require Finance approval.
- [[people/carol-white]] is the approver.

## People
- [[people/eve-rodriguez]] — Customer Success Lead
- [[people/carol-white]] — Finance Manager`,
  },
  {
    slug: "policies/incident-escalation",
    title: "Incident Escalation",
    type: "policy",
    content: `# Incident Escalation

## On-Call Rotation
- Primary: Engineering on-call (PagerDuty)
- Secondary: Engineering manager

## Severity Levels
- SEV1: Customer-facing outage — page on-call immediately
- SEV2: Degraded performance — ticket + Slack alert
- SEV3: Minor bug — next-business-day fix

## People
- [[people/david-kim]] — CTO`,
  },
];

const decisions: PageDraft[] = [
  {
    slug: "decisions/pricing-acme-corp-45k",
    title: "Pricing Exception: Acme Corp $45K",
    type: "decision",
    content: `# Pricing Exception: Acme Corp $45K

**Decision:** Approved at $45K (standard discount)
**Approver:** [[people/alice-chen]]
**Date:** 2026-03-15
**Source:** Slack #sales-deals

No escalation needed. Deal under $50K threshold.`,
  },
  {
    slug: "decisions/pricing-beta-inc-120k",
    title: "Pricing Exception: Beta Inc $120K",
    type: "decision",
    content: `# Pricing Exception: Beta Inc $120K

**Decision:** Escalated to Legal
**Approver:** [[people/bob-martinez]] (Legal) + VP required
**Date:** 2026-03-22
**Source:** Slack #sales-deals

Deal over $100K. Required Legal review and VP sign-off.`,
  },
  {
    slug: "decisions/pricing-gamma-llc-38k",
    title: "Pricing Exception: Gamma LLC $38K",
    type: "decision",
    content: `# Pricing Exception: Gamma LLC $38K

**Decision:** Approved
**Approver:** [[people/alice-chen]]
**Date:** 2026-04-01
**Source:** Slack #sales-deals

Standard approval under $50K.`,
  },
  {
    slug: "decisions/pricing-delta-co-150k",
    title: "Pricing Exception: Delta Co $150K",
    type: "decision",
    content: `# Pricing Exception: Delta Co $150K

**Decision:** Approved after Legal + Finance review
**Approver:** [[people/bob-martinez]] (Legal), [[people/carol-white]] (Finance)
**Date:** 2026-04-10
**Source:** Slack #sales-deals

Deal over $100K. Full escalation path triggered.`,
  },
  {
    slug: "decisions/pricing-megacorp-600k",
    title: "Pricing Exception: MegaCorp $600K",
    type: "decision",
    content: `# Pricing Exception: MegaCorp $600K

**Decision:** Approved with CEO involvement
**Approver:** [[people/alice-chen]] (initial), [[people/bob-martinez]] (Legal), CEO final
**Date:** 2026-04-18
**Source:** Slack #sales-deals

Massive deal. CEO got involved informally — not in any policy doc.`,
  },
  {
    slug: "decisions/refund-standard-200",
    title: "Refund: Standard $200",
    type: "decision",
    content: `# Refund: Standard $200

**Decision:** Approved
**Handler:** [[people/eve-rodriguez]] (Customer Success)
**Date:** 2026-01-10
**Source:** Slack #customer-success

Standard refund under $10K. No escalation needed.`,
  },
  {
    slug: "decisions/refund-partial-15k",
    title: "Refund: Partial $15K",
    type: "decision",
    content: `# Refund: Partial $15K

**Decision:** Approved
**Approver:** [[people/carol-white]] (Finance)
**Date:** 2026-02-05
**Source:** Slack #customer-success

Partial refund over $10K. Finance approval required per policy.`,
  },
  {
    slug: "decisions/refund-annual-contract-30k",
    title: "Refund: Annual Contract $30K (Day 75)",
    type: "decision",
    content: `# Refund: Annual Contract $30K (Day 75)

**Decision:** Denied — past 60-day window
**Approver:** [[people/carol-white]] (Finance)
**Date:** 2026-03-18
**Source:** Slack #customer-success

Customer requested refund on day 75 of annual contract. Denied per unwritten rule: "We never refund annual contracts past day 60." This is not in the official policy doc.`,
  },
  {
    slug: "decisions/incident-megacorp-feb",
    title: "Incident: MegaCorp Outage (Feb 2026)",
    type: "decision",
    content: `# Incident: MegaCorp Outage (Feb 2026)

**Severity:** SEV1
**Impact:** MegaCorp ($600K ARR) down for 45 minutes
**Response:** [[people/david-kim]] (CTO) was paged directly
**Date:** 2026-02-14
**Source:** PagerDuty + Slack #incidents

CTO was auto-paged because MegaCorp is a high-value customer. This triggered an informal precedent: any customer with >$500K ARR gets CTO paged on SEV1.`,
  },
  {
    slug: "decisions/incident-ventureco-mar",
    title: "Incident: VentureCo Degraded (Mar 2026)",
    type: "decision",
    content: `# Incident: VentureCo Degraded (Mar 2026)

**Severity:** SEV2
**Impact:** VentureCo ($520K ARR) slow queries for 20 minutes
**Response:** [[people/david-kim]] (CTO) was paged despite SEV2 classification
**Date:** 2026-03-08
**Source:** PagerDuty + Slack #incidents

CTO got paged again for a high-value customer even though this was only SEV2. Pattern confirmed: >$500K ARR = CTO involvement regardless of severity.`,
  },
];

const links: { from: string; to: string; type: string }[] = [
  { from: "policies/pricing-exceptions", to: "people/alice-chen", type: "involves" },
  { from: "policies/pricing-exceptions", to: "people/bob-martinez", type: "requires" },
  { from: "policies/pricing-exceptions", to: "decisions/pricing-acme-corp-45k", type: "precedent" },
  { from: "policies/pricing-exceptions", to: "decisions/pricing-beta-inc-120k", type: "precedent" },
  { from: "policies/pricing-exceptions", to: "decisions/pricing-gamma-llc-38k", type: "precedent" },
  { from: "policies/pricing-exceptions", to: "decisions/pricing-delta-co-150k", type: "precedent" },
  { from: "policies/pricing-exceptions", to: "decisions/pricing-megacorp-600k", type: "precedent" },

  { from: "policies/refund-policy", to: "people/eve-rodriguez", type: "handled_by" },
  { from: "policies/refund-policy", to: "people/carol-white", type: "requires_approval" },
  { from: "policies/refund-policy", to: "decisions/refund-standard-200", type: "precedent" },
  { from: "policies/refund-policy", to: "decisions/refund-partial-15k", type: "precedent" },
  { from: "policies/refund-policy", to: "decisions/refund-annual-contract-30k", type: "precedent" },

  { from: "policies/incident-escalation", to: "people/david-kim", type: "escalates_to" },
  { from: "policies/incident-escalation", to: "decisions/incident-megacorp-feb", type: "precedent" },
  { from: "policies/incident-escalation", to: "decisions/incident-ventureco-mar", type: "precedent" },

  { from: "decisions/pricing-acme-corp-45k", to: "people/alice-chen", type: "approved_by" },
  { from: "decisions/pricing-beta-inc-120k", to: "people/bob-martinez", type: "approved_by" },
  { from: "decisions/pricing-megacorp-600k", to: "people/alice-chen", type: "involves" },
  { from: "decisions/pricing-megacorp-600k", to: "people/bob-martinez", type: "involves" },
  { from: "decisions/refund-standard-200", to: "people/eve-rodriguez", type: "handled_by" },
  { from: "decisions/refund-partial-15k", to: "people/carol-white", type: "approved_by" },
  { from: "decisions/refund-annual-contract-30k", to: "people/carol-white", type: "approved_by" },
  { from: "decisions/incident-megacorp-feb", to: "people/david-kim", type: "handled_by" },
  { from: "decisions/incident-ventureco-mar", to: "people/david-kim", type: "handled_by" },
];

const timelineEntries: { slug: string; date: string; summary: string; detail?: string }[] = [
  { slug: "policies/pricing-exceptions", date: "2026-03-15", summary: "Acme Corp $45K approved by Alice", detail: "No escalation needed. Standard under-$50K approval." },
  { slug: "policies/pricing-exceptions", date: "2026-03-22", summary: "Beta Inc $120K escalated to Legal", detail: "Bob Martinez required 48h review. VP sign-off obtained." },
  { slug: "policies/pricing-exceptions", date: "2026-04-01", summary: "Gamma LLC $38K approved same day", detail: "Alice approved within 2 hours." },
  { slug: "policies/pricing-exceptions", date: "2026-04-10", summary: "Delta Co $150K required Finance + Legal", detail: "Full escalation. Bob and Carol both approved." },
  { slug: "policies/pricing-exceptions", date: "2026-04-18", summary: "MegaCorp $600K — CEO got involved", detail: "No policy mentions CEO for pricing. Informal precedent." },

  { slug: "policies/refund-policy", date: "2026-01-10", summary: "Standard $200 refund handled by CS", detail: "Eve approved within 1 hour." },
  { slug: "policies/refund-policy", date: "2026-02-05", summary: "Partial $15K refund — Carol approved", detail: "Over $10K threshold. Finance review required." },
  { slug: "policies/refund-policy", date: "2026-03-18", summary: "$30K refund denied (day 75)", detail: "Unwritten rule: no annual refunds past day 60. Not in policy doc." },

  { slug: "policies/incident-escalation", date: "2026-02-14", summary: "MegaCorp outage — CTO auto-paged", detail: "$600K ARR customer. SEV1. David responded in 4 minutes." },
  { slug: "policies/incident-escalation", date: "2026-03-08", summary: "VentureCo degraded — CTO paged on SEV2", detail: "$520K ARR. Only SEV2 but CTO got paged anyway. Pattern forming." },
];

async function upsertPage(p: PageDraft) {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM pages WHERE brain_id = $1 AND slug = $2",
    [BRAIN_ID, p.slug]
  );

  if (existing) {
    await query(
      `UPDATE pages SET title = $3, type = $4, content = $5, frontmatter = $6, updated_at = NOW()
       WHERE brain_id = $1 AND slug = $2`,
      [BRAIN_ID, p.slug, p.title, p.type, p.content, JSON.stringify(p.frontmatter || {})]
    );
    return existing.id;
  } else {
    const result = await queryOne<{ id: string }>(
      `INSERT INTO pages (brain_id, slug, title, type, content, frontmatter, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
      [BRAIN_ID, p.slug, p.title, p.type, p.content, JSON.stringify(p.frontmatter || {})]
    );
    return result!.id;
  }
}

async function seed() {
  console.log("[seed] Starting demo brain seed...");

  // Ensure brain exists
  const brain = await queryOne<{ id: string }>(
    "SELECT id FROM brains WHERE id = $1",
    [BRAIN_ID]
  );
  if (!brain) {
    await query(
      `INSERT INTO brains (id, name, description, created_by, public_access, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [BRAIN_ID, "Demo Brain", "Public demo brain for Acme SaaS", "demo", true]
    );
    console.log("[seed] Created demo brain:", BRAIN_ID);
  } else {
    console.log("[seed] Demo brain exists:", BRAIN_ID);
  }

  // Upsert all pages
  const pageIds = new Map<string, string>();
  for (const p of [...people, ...policies, ...decisions]) {
    const id = await upsertPage(p);
    pageIds.set(p.slug, id);
    console.log(`[seed] Upserted: ${p.slug}`);
  }

  // Upsert links
  for (const link of links) {
    const fromId = pageIds.get(link.from);
    const toId = pageIds.get(link.to);
    if (!fromId || !toId) {
      console.warn(`[seed] Missing page for link: ${link.from} -> ${link.to}`);
      continue;
    }
    await query(
      `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (brain_id, from_page_id, to_page_id, link_type) DO NOTHING`,
      [BRAIN_ID, fromId, toId, link.type]
    );
    console.log(`[seed] Link: ${link.from} -> ${link.to}`);
  }

  // Upsert timeline entries
  for (const t of timelineEntries) {
    const pageId = pageIds.get(t.slug);
    if (!pageId) {
      console.warn(`[seed] Missing page for timeline: ${t.slug}`);
      continue;
    }
    await query(
      `INSERT INTO timeline_entries (brain_id, page_id, date, summary, detail, source, written_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT DO NOTHING`,
      [BRAIN_ID, pageId, t.date, t.summary, t.detail || null, "seed-script", "seed-script"]
    );
    console.log(`[seed] Timeline: ${t.slug} @ ${t.date}`);
  }

  console.log("\n[seed] ✅ Done! Demo brain seeded:");
  console.log(`  People:       ${people.length}`);
  console.log(`  Policies:     ${policies.length}`);
  console.log(`  Decisions:    ${decisions.length}`);
  console.log(`  Links:        ${links.length}`);
  console.log(`  Timeline:     ${timelineEntries.length}`);
  console.log(`\nBrain ID: ${BRAIN_ID}`);
  console.log(`\nTest it:`);
  console.log(`  curl "https://brainbase.belweave.ai/api/skills/demo?task=pricing+exceptions"`);
}

seed().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
