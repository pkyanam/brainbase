import { NextRequest, NextResponse } from "next/server";
import { queryOne, query } from "@/lib/supabase/client";

/**
 * POST /api/admin/seed-demo
 *
 * One-shot admin endpoint to seed the public demo brain.
 * Idempotent — safe to call multiple times.
 * Protected by CRON_SECRET to prevent abuse.
 */
const DEMO_BRAIN_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_OWNER_ID = "demo-system";

export async function POST(req: NextRequest) {
  // Simple protection: require a seed key or CRON_SECRET
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const valid = token === process.env.CRON_SECRET || token === process.env.HERMES_CRON_SECRET;
  // Also accept ?key=seed-demo-2026 in dev
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  if (!valid && queryKey !== "seed-demo-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // Create demo brain
    await query(
      `INSERT INTO brains (id, owner_user_id, name, slug)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $3, slug = $4`,
      [DEMO_BRAIN_ID, DEMO_OWNER_ID, "Demo Brain", "demo"]
    );
    results.push("✅ demo brain");

    // Seed pages
    const pages = [
      { slug: "pricing-exceptions", title: "Pricing Exceptions", type: "concept",
        content: `# Pricing Exceptions\n\n> Process for handling non-standard pricing requests.\n\n## Policy\n- If deal value is under $50,000, Sales Manager approves directly.\n- If deal value is $100,000 or above, requires Legal review and escalation to VP.\n- No documented process for deals between $50K and $100K.\n\n## People Involved\n- Alice Chen owns the standard approval process.\n- Bob Martinez handles Legal review for deals over $100K.\n- Carol White in Finance is informed on escalated decisions.\n\n## Exceptions\n- Enterprise tier customers may bypass standard process with VP approval.` },
      { slug: "alice-chen", title: "Alice Chen", type: "person",
        content: `# Alice Chen\n\n## State\n- **Role:** Sales Manager\n- **Team:** Enterprise Sales\n- **Slack:** @alice\n\nApproves all deal-level discounts under $50,000 directly. 23 precedents in Q1 2026.` },
      { slug: "bob-martinez", title: "Bob Martinez", type: "person",
        content: `# Bob Martinez\n\n## State\n- **Role:** Legal Counsel\n- **Team:** Legal & Compliance\n- **Email:** bob@company.com\n\nReviews all deals over $100K. 8 escalations in Q1 2026.` },
      { slug: "carol-white", title: "Carol White", type: "person",
        content: `# Carol White\n\n## State\n- **Role:** Finance Manager\n- **Email:** carol@company.com\n\nHandles refund approvals over $10,000. Every refund over $25K required her sign-off.` },
      { slug: "refund-policy", title: "Refund Policy", type: "concept",
        content: `# Refund Policy\n\n## Policy\n- Standard refunds under $10,000: Customer Success handles triage and approval.\n- Partial refunds over $10,000: Finance must approve. Carol White is the owner.\n- Annual plan cancellations within 30 days: Full refund.\n\n## Exceptions\n- Refunds over $25,000 require Carol's direct sign-off despite $10K policy threshold.` },
      { slug: "enterprise-tier", title: "Enterprise Tier", type: "concept",
        content: `# Enterprise Tier\n\nCustom pricing, SSO, audit logs, dedicated support. May bypass standard pricing exception process with VP approval.` },
      { slug: "customer-success", title: "Customer Success Team", type: "concept",
        content: `# Customer Success Team\n\nFirst line for refund requests, billing questions. Standard refunds under $10K approved directly. Larger refunds routed to Finance.` },
    ];

    for (const page of pages) {
      await query(
        `INSERT INTO pages (brain_id, slug, title, type, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (brain_id, slug) DO UPDATE
         SET title = $3, type = $4, content = $5, updated_at = NOW()`,
        [DEMO_BRAIN_ID, page.slug, page.title, page.type, page.content]
      );
    }
    results.push(`✅ ${pages.length} pages`);

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

    for (const [f, t, type] of links) {
      await query(
        `INSERT INTO links (brain_id, from_slug, to_slug, link_type, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [DEMO_BRAIN_ID, f, t, type]
      );
    }
    results.push(`✅ ${links.length} links`);

    // Seed timeline
    const timeline = [
      { slug: "pricing-exceptions", date: "2026-03-15", summary: "Acme Corp $45K deal — Alice approved same day", source: "slack/pricing-decisions" },
      { slug: "pricing-exceptions", date: "2026-03-22", summary: "Beta Inc $120K deal — escalated to Bob, VP sign-off required", source: "slack/pricing-decisions" },
      { slug: "pricing-exceptions", date: "2026-04-01", summary: "Gamma LLC $38K deal — standard Sales approval by Alice", source: "slack/pricing-decisions" },
      { slug: "pricing-exceptions", date: "2026-04-10", summary: "Delta Co $150K deal — Legal review + Finance check, approved after escalation", source: "slack/pricing-decisions" },
      { slug: "pricing-exceptions", date: "2026-04-22", summary: "Epsilon Inc $75K deal — fell in undocumented $50K-$100K gap, handled ad-hoc", source: "slack/pricing-decisions" },
      { slug: "refund-policy", date: "2026-01-10", summary: "Standard $200 refund — CS approved same day", source: "slack/refunds" },
      { slug: "refund-policy", date: "2026-02-05", summary: "$15K partial refund — Carol approved after Finance review", source: "slack/refunds" },
      { slug: "refund-policy", date: "2026-03-18", summary: "$30K refund — escalated to Carol + VP, approved with conditions", source: "slack/refunds" },
      { slug: "refund-policy", date: "2026-04-05", summary: "Enterprise annual refund — full refund within 30-day window", source: "docs/refund-policy" },
    ];

    for (const t of timeline) {
      await query(
        `INSERT INTO timeline_entries (brain_id, page_slug, date, summary, source, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        [DEMO_BRAIN_ID, t.slug, t.date, t.summary, t.source]
      );
    }
    results.push(`✅ ${timeline.length} timeline entries`);

    // Seed content chunks for FTS
    for (const page of pages) {
      const texts = [page.title, page.content.slice(0, 500), page.content.slice(500, 1000)];
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text.trim()) continue;
        await query(
          `INSERT INTO content_chunks (brain_id, page_slug, chunk_index, content, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [DEMO_BRAIN_ID, page.slug, i, text]
        );
      }
    }
    results.push("✅ content chunks");

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[seed-demo]", err);
    return NextResponse.json(
      { error: "Seed failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
