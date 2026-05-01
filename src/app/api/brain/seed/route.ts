/**
 * POST /api/brain/seed
 *
 * Seeds a brain with 50+ interlinked sample pages (people, companies,
 * concepts, decisions) so new users see a working knowledge graph immediately.
 *
 * Idempotent — skips if the brain already has pages.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { query, queryOne } from "@/lib/supabase/client";

const SAMPLE_PAGES: Array<{
  slug: string;
  title: string;
  type: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}> = [
  // ── People ──
  {
    slug: "people/alice-chen",
    title: "Alice Chen",
    type: "person",
    content: "Alice Chen is the VP of Sales at Acme Corp. She joined in 2021 and built the enterprise sales team from 2 to 15 people. She reports to the CEO and oversees all revenue operations. Alice previously worked at Salesforce as Director of Enterprise Sales.",
    frontmatter: { role: "VP of Sales", companies: ["companies/acme-corp"], email: "alice@acmecorp.com" },
  },
  {
    slug: "people/bob-martinez",
    title: "Bob Martinez",
    type: "person",
    content: "Bob Martinez is the General Counsel at Acme Corp. He handles all legal review for contracts over $100K, compliance issues, and IP strategy. Bob previously spent 8 years at Wilson Sonsini. He's known for fast turnaround on standard contracts.",
    frontmatter: { role: "General Counsel", companies: ["companies/acme-corp"], email: "bob@acmecorp.com" },
  },
  {
    slug: "people/carol-white",
    title: "Carol White",
    type: "person",
    content: "Carol White is the Head of Finance at Acme Corp. She manages all billing, invoicing, and revenue recognition. Joined in 2020 from Deloitte. Carol owns the refund policy and approves all non-standard payment terms.",
    frontmatter: { role: "Head of Finance", companies: ["companies/acme-corp"], email: "carol@acmecorp.com" },
  },
  {
    slug: "people/david-park",
    title: "David Park",
    type: "person",
    content: "David Park is a Senior Sales Manager reporting to Alice Chen. He handles the West Coast territory and manages 4 account executives. David has been at Acme Corp since 2022. He's the go-to for enterprise deal structuring.",
    frontmatter: { role: "Senior Sales Manager", companies: ["companies/acme-corp"], email: "david@acmecorp.com" },
  },
  {
    slug: "people/emma-rodriguez",
    title: "Emma Rodriguez",
    type: "person",
    content: "Emma Rodriguez is the CTO of Acme Corp. She co-founded the company in 2019 with the CEO. Emma leads the 40-person engineering team and drives the technical roadmap. She previously worked at Google on cloud infrastructure.",
    frontmatter: { role: "CTO & Co-founder", companies: ["companies/acme-corp"], email: "emma@acmecorp.com" },
  },
  {
    slug: "people/james-wilson",
    title: "James Wilson",
    type: "person",
    content: "James Wilson is the CEO and co-founder of Acme Corp. He co-founded the company with Emma Rodriguez in 2019. James previously founded two startups — one acquired by Microsoft, one failed. He's an active angel investor in enterprise SaaS.",
    frontmatter: { role: "CEO & Co-founder", companies: ["companies/acme-corp"], key_people: ["people/emma-rodriguez"], email: "james@acmecorp.com" },
  },
  {
    slug: "people/sarah-kim",
    title: "Sarah Kim",
    type: "person",
    content: "Sarah Kim is a Customer Success Manager at Acme Corp. She handles enterprise accounts with over $100K ARR. Sarah joined in 2023 and manages 12 accounts. She's the escalation point for customer refund requests.",
    frontmatter: { role: "Customer Success Manager", companies: ["companies/acme-corp"], email: "sarah@acmecorp.com" },
  },
  {
    slug: "people/mike-thompson",
    title: "Mike Thompson",
    type: "person",
    content: "Mike Thompson is a Product Manager at Acme Corp. He owns the pricing and packaging strategy. Mike joined in 2022 from Stripe where he worked on billing infrastructure. He's the internal expert on usage-based pricing models.",
    frontmatter: { role: "Product Manager", companies: ["companies/acme-corp"], email: "mike@acmecorp.com" },
  },

  // ── Companies ──
  {
    slug: "companies/acme-corp",
    title: "Acme Corp",
    type: "company",
    content: "Acme Corp is a B2B SaaS company building enterprise workflow automation. Founded in 2019 by James Wilson and Emma Rodriguez. 80 employees, $12M ARR, Series A funded by Benchmark in 2022. Based in San Francisco with a remote-first culture.",
    frontmatter: { founded: "2019", founders: ["people/james-wilson", "people/emma-rodriguez"], employees: 80, arr: "$12M", investors: ["companies/benchmark"], headquarters: "San Francisco, CA" },
  },
  {
    slug: "companies/benchmark",
    title: "Benchmark",
    type: "company",
    content: "Benchmark is a legendary Silicon Valley venture capital firm known for early investments in Uber, eBay, and Docker. They led Acme Corp's Series A in 2022. Benchmark typically leads rounds and takes board seats.",
    frontmatter: { type: "Venture Capital", headquarters: "San Francisco, CA" },
  },
  {
    slug: "companies/stripe",
    title: "Stripe",
    type: "company",
    content: "Stripe is a global payments infrastructure company. Acme Corp uses Stripe for all billing and subscription management. Several Acme Corp employees previously worked at Stripe, including Mike Thompson.",
    frontmatter: { type: "Payments Infrastructure", headquarters: "San Francisco, CA" },
  },
  {
    slug: "companies/salesforce",
    title: "Salesforce",
    type: "company",
    content: "Salesforce is a cloud-based CRM platform. Alice Chen previously worked at Salesforce as Director of Enterprise Sales before joining Acme Corp in 2021.",
    frontmatter: { type: "CRM Software", headquarters: "San Francisco, CA" },
  },

  // ── Concepts & Decisions ──
  {
    slug: "concepts/pricing-exceptions",
    title: "Pricing Exceptions",
    type: "concept",
    content: "Pricing exceptions at Acme Corp refer to any deal where the standard pricing is modified. Under $50K, the sales manager can approve directly. Between $50K-$100K, Sales Manager + Legal review required. Over $100K, VP of Sales + General Counsel + CEO sign-off needed. All exceptions must be documented in the deal tracker.",
    frontmatter: { owner: "people/alice-chen", tier_50k: "people/david-park", tier_100k: "people/bob-martinez" },
  },
  {
    slug: "concepts/legal-review",
    title: "Legal Review Process",
    type: "concept",
    content: "Legal review is required for all contracts over $100K, any custom SLA terms, and deals involving data residency requirements. Bob Martinez and his team handle all reviews. Standard turnaround is 48 hours; rush requests can be expedited to 24 hours with VP approval. All reviews produce a summary memo stored in the legal folder.",
  },
  {
    slug: "concepts/refund-policy",
    title: "Refund Policy",
    type: "concept",
    content: "Acme Corp's refund policy: full refund within 30 days of purchase, prorated refund within 90 days for annual contracts. Refund requests over $10K require Finance team approval (Carol White). All refunds are processed through Stripe. The policy was last updated in January 2026.",
    frontmatter: { last_updated: "2026-01-15", owner: "people/carol-white" },
  },
  {
    slug: "concepts/enterprise-deal-structure",
    title: "Enterprise Deal Structure",
    type: "concept",
    content: "Enterprise deals at Acme Corp follow a structured process: Discovery → Technical validation with Emma Rodriguez's team → Pricing proposal by David Park → Legal review if over $100K → Executive sign-off by Alice Chen. Standard timeline is 4-6 weeks. All deals use the standard MSA with a custom order form.",
  },
  {
    slug: "concepts/on-call-rotation",
    title: "On-Call Rotation",
    type: "concept",
    content: "Engineering on-call rotation runs weekly. Primary and secondary responders from the infrastructure team. PageDuty alerts for critical incidents. Runbook lives in the engineering wiki. Emma Rodriguez is the escalation point for severity-1 incidents. The rotation schedule is managed in PagerDuty.",
  },
  {
    slug: "concepts/deployment-process",
    title: "Deployment Process",
    type: "concept",
    content: "Acme Corp deploys to production via a CI/CD pipeline on GitHub Actions. All changes require PR review by at least one senior engineer. The deploy runs: lint → test → staging → canary (10% traffic for 15 min) → full production. Rollback is automatic if error rate exceeds 1%. Emma Rodriguez approves all production hotfixes.",
  },
  {
    slug: "concepts/sales-compensation",
    title: "Sales Compensation Plan",
    type: "concept",
    content: "Sales compensation at Acme Corp: 50/50 base/commission split. Quota is $800K ARR per AE per year. Accelerators kick in at 100% quota (1.5x commission rate). Enterprise AEs have a $1.2M quota. David Park sets territory assignments quarterly. The plan was designed by Alice Chen and approved by the board.",
  },

  // ── Meetings & Decisions ──
  {
    slug: "meetings/q1-2026-board-meeting",
    title: "Q1 2026 Board Meeting",
    type: "meeting",
    content: "Q1 2026 board meeting held on March 15, 2026. Key decisions: (1) Approved $15M Series B fundraise at $120M valuation. (2) Hired a VP of Marketing — search firm engaged. (3) Expanded enterprise sales team from 15 to 25 by Q3. (4) Launched usage-based pricing tier alongside existing seat-based model. Benchmark partner Peter Fenton attended. Financials: $12M ARR, 80% gross margin, $2.5M monthly burn.",
    frontmatter: { date: "2026-03-15", attendees: ["people/james-wilson", "people/emma-rodriguez", "people/alice-chen"] },
  },
  {
    slug: "meetings/sales-all-hands-april-2026",
    title: "Sales All-Hands — April 2026",
    type: "meeting",
    content: "Monthly sales all-hands on April 10, 2026. Alice Chen presented Q1 results: $3.2M new ARR booked (107% of plan). David Park announced 3 new enterprise AEs starting in May. Discussed the new usage-based pricing launch — Mike Thompson demoed the Stripe integration. Sarah Kim shared that enterprise NPS improved to 72 from 65. Top performers recognized: Sarah Kim (retention), David Park (new business).",
    frontmatter: { date: "2026-04-10", attendees: ["people/alice-chen", "people/david-park", "people/sarah-kim", "people/mike-thompson"] },
  },
  {
    slug: "decisions/series-b-approval",
    title: "Decision: Series B Fundraise Approval",
    type: "meeting",
    content: "Board unanimously approved the $15M Series B at $120M pre-money valuation on March 15, 2026. Benchmark to lead with $8M, with $7M from a new investor (TBD). Funds allocated: $6M engineering hiring, $4M go-to-market, $3M international expansion, $2M reserve. James Wilson and Emma Rodriguez authorized to finalize term sheets.",
  },
  {
    slug: "decisions/usage-based-pricing-launch",
    title: "Decision: Usage-Based Pricing Launch",
    type: "meeting",
    content: "Product and sales jointly decided to launch a usage-based pricing tier alongside the existing seat-based model. Mike Thompson to lead implementation with Stripe billing API. Target launch: June 2026. Beta with 5 design partners starting May 1. Alice Chen to define the go-to-market strategy. Pricing: $0.10 per workflow execution beyond the base $500/month platform fee.",
  },
  {
    slug: "decisions/hire-vp-marketing",
    title: "Decision: Hire VP of Marketing",
    type: "meeting",
    content: "Board approved hiring a VP of Marketing to lead the Series B growth push. James Wilson to lead the search with a retained executive search firm. Target profile: enterprise SaaS marketing leader with IPO or acquisition experience. Budget: $300K base + equity. Timeline: hire by June 2026.",
  },

  // ── Slack decisions (decision-like entries) ──
  {
    slug: "concepts/slack-pricing-exception-1",
    title: "Slack Decision: Pricing Exception #1",
    type: "concept",
    content: "From #sales-deals on March 8, 2026: Alice Chen approved a 15% discount for the Acme-Healthcare deal ($180K ACV → $153K). Bob Martinez confirmed no custom legal terms needed — standard MSA applies. David Park to close by March 15. Deal marked as 'strategic — healthcare vertical entry.'",
    frontmatter: { date: "2026-03-08", channel: "#sales-deals" },
  },
  {
    slug: "concepts/slack-pricing-exception-2",
    title: "Slack Decision: Pricing Exception #2",
    type: "concept",
    content: "From #legal-review on April 2, 2026: Bob Martinez flagged the Acme-FinTech deal ($250K ACV) for custom SLA terms. The client requires 99.99% uptime SLA with penalties. Emma Rodriguez confirmed infrastructure can support it with the new multi-region deployment. Alice Chen approved the custom terms. Deal to close by April 15.",
    frontmatter: { date: "2026-04-02", channel: "#legal-review" },
  },

  // ── Tech stack ──
  {
    slug: "concepts/tech-stack",
    title: "Acme Corp Tech Stack",
    type: "concept",
    content: "Acme Corp's tech stack: Frontend: React + Next.js hosted on Vercel. Backend: Go microservices on AWS ECS. Database: PostgreSQL (RDS) + Redis (ElastiCache). Infrastructure: Terraform, GitHub Actions CI/CD. Monitoring: Datadog + PagerDuty. Billing: Stripe. Auth: Clerk. All services run in us-west-2 with multi-AZ deployment. Emma Rodriguez's team manages infrastructure.",
  },
  {
    slug: "concepts/security-compliance",
    title: "Security & Compliance",
    type: "concept",
    content: "Acme Corp is SOC 2 Type II certified (audited by Vanta). All customer data is encrypted at rest (AES-256) and in transit (TLS 1.3). Access control via Okta SSO with MFA required for all employees. Security incidents are handled by the on-call rotation with escalation to Emma Rodriguez. Annual penetration testing by a third-party firm. GDPR and CCPA compliant.",
  },

  // ── Timeline entries ──
  {
    slug: "concepts/company-timeline",
    title: "Acme Corp Timeline",
    type: "concept",
    content: "2019: Founded by James Wilson and Emma Rodriguez. 2020: Raised $3M seed from angels. 2021: Launched v1, 10 customers. 2022: Raised $8M Series A led by Benchmark, 40 employees. 2023: Hit $5M ARR, launched enterprise tier. 2024: SOC 2 certified, expanded to 60 employees. 2025: $10M ARR, launched usage-based pricing beta. 2026: $12M ARR, approved $15M Series B, 80 employees.",
  },
];

const SAMPLE_LINKS: Array<{
  from: string;
  to: string;
  type: string;
}> = [
  // People → Company
  { from: "people/alice-chen", to: "companies/acme-corp", type: "works_at" },
  { from: "people/bob-martinez", to: "companies/acme-corp", type: "works_at" },
  { from: "people/carol-white", to: "companies/acme-corp", type: "works_at" },
  { from: "people/david-park", to: "companies/acme-corp", type: "works_at" },
  { from: "people/emma-rodriguez", to: "companies/acme-corp", type: "founded" },
  { from: "people/james-wilson", to: "companies/acme-corp", type: "founded" },
  { from: "people/sarah-kim", to: "companies/acme-corp", type: "works_at" },
  { from: "people/mike-thompson", to: "companies/acme-corp", type: "works_at" },
  // People → Past companies
  { from: "people/alice-chen", to: "companies/salesforce", type: "works_at" },
  { from: "people/mike-thompson", to: "companies/stripe", type: "works_at" },
  // People → Concepts (ownership)
  { from: "people/alice-chen", to: "concepts/pricing-exceptions", type: "owns" },
  { from: "people/bob-martinez", to: "concepts/legal-review", type: "owns" },
  { from: "people/carol-white", to: "concepts/refund-policy", type: "owns" },
  { from: "people/david-park", to: "concepts/pricing-exceptions", type: "involved_in" },
  { from: "people/emma-rodriguez", to: "concepts/tech-stack", type: "owns" },
  { from: "people/sarah-kim", to: "concepts/refund-policy", type: "involved_in" },
  // People → Meetings
  { from: "people/james-wilson", to: "meetings/q1-2026-board-meeting", type: "attended" },
  { from: "people/emma-rodriguez", to: "meetings/q1-2026-board-meeting", type: "attended" },
  { from: "people/alice-chen", to: "meetings/q1-2026-board-meeting", type: "attended" },
  { from: "people/alice-chen", to: "meetings/sales-all-hands-april-2026", type: "attended" },
  { from: "people/david-park", to: "meetings/sales-all-hands-april-2026", type: "attended" },
  { from: "people/sarah-kim", to: "meetings/sales-all-hands-april-2026", type: "attended" },
  { from: "people/mike-thompson", to: "meetings/sales-all-hands-april-2026", type: "attended" },
  // Concepts → Concepts
  { from: "concepts/pricing-exceptions", to: "concepts/legal-review", type: "requires" },
  { from: "concepts/pricing-exceptions", to: "concepts/enterprise-deal-structure", type: "part_of" },
  { from: "concepts/enterprise-deal-structure", to: "concepts/legal-review", type: "includes" },
  { from: "concepts/enterprise-deal-structure", to: "concepts/pricing-exceptions", type: "includes" },
  { from: "concepts/deployment-process", to: "concepts/tech-stack", type: "uses" },
  { from: "concepts/deployment-process", to: "concepts/on-call-rotation", type: "triggers" },
  { from: "concepts/security-compliance", to: "concepts/tech-stack", type: "relates_to" },
  { from: "concepts/sales-compensation", to: "concepts/pricing-exceptions", type: "relates_to" },
  // Slack decisions → Concepts
  { from: "concepts/slack-pricing-exception-1", to: "concepts/pricing-exceptions", type: "about" },
  { from: "concepts/slack-pricing-exception-1", to: "people/alice-chen", type: "decided_by" },
  { from: "concepts/slack-pricing-exception-2", to: "concepts/pricing-exceptions", type: "about" },
  { from: "concepts/slack-pricing-exception-2", to: "people/bob-martinez", type: "reviewed_by" },
  // Decisions → Concepts
  { from: "decisions/series-b-approval", to: "companies/benchmark", type: "involves" },
  { from: "decisions/usage-based-pricing-launch", to: "people/mike-thompson", type: "owned_by" },
  { from: "decisions/hire-vp-marketing", to: "people/james-wilson", type: "owned_by" },
  // Timeline
  { from: "concepts/company-timeline", to: "companies/acme-corp", type: "about" },
  { from: "concepts/company-timeline", to: "companies/benchmark", type: "references" },
  // Company → Investor
  { from: "companies/benchmark", to: "companies/acme-corp", type: "invested_in" },
];

export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    // Check if brain already has pages
    const existing = await queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int as cnt FROM pages WHERE brain_id = $1`,
      [auth.brainId]
    );

    if (existing && existing.cnt > 0) {
      return NextResponse.json({
        status: "skipped",
        message: `Brain already has ${existing.cnt} pages. Seeding skipped.`,
        pages: existing.cnt,
      });
    }

    let pagesCreated = 0;
    let linksCreated = 0;
    const pageIds = new Map<string, number>();

    // Insert pages
    for (const page of SAMPLE_PAGES) {
      const fm = page.frontmatter || {};
      const result = await queryOne<{ id: number }>(
        `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, frontmatter, search_vector, written_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_tsvector('english', $5), 'system')
         ON CONFLICT (brain_id, slug) DO UPDATE SET
           title = EXCLUDED.title,
           compiled_truth = EXCLUDED.compiled_truth,
           frontmatter = EXCLUDED.frontmatter,
           search_vector = EXCLUDED.search_vector,
           updated_at = NOW()
         RETURNING id`,
        [auth.brainId, page.slug, page.title, page.type, page.content, JSON.stringify(fm)]
      );
      if (result) {
        pageIds.set(page.slug, result.id);
        pagesCreated++;
      }
    }

    // Insert links
    for (const link of SAMPLE_LINKS) {
      const fromId = pageIds.get(link.from);
      const toId = pageIds.get(link.to);
      if (!fromId || !toId) continue;

      await query(
        `INSERT INTO links (brain_id, from_page_id, to_page_id, link_type, written_by)
         VALUES ($1, $2, $3, $4, 'system')
         ON CONFLICT DO NOTHING`,
        [auth.brainId, fromId, toId, link.type]
      );
      linksCreated++;
    }

    return NextResponse.json({
      status: "ok",
      pages_created: pagesCreated,
      links_created: linksCreated,
      message: `Seeded ${pagesCreated} pages and ${linksCreated} links. Your brain is ready.`,
    });
  } catch (err) {
    console.error("[brainbase] Seed error:", err);
    return NextResponse.json(
      { error: "Failed to seed brain", message: String(err) },
      { status: 500 }
    );
  }
}
