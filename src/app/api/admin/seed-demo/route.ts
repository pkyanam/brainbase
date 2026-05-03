import { NextRequest, NextResponse } from "next/server";
import { queryOne, query } from "@/lib/supabase/client";

const DEMO_BRAIN_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_OWNER_ID = "demo-system";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const valid = token === process.env.CRON_SECRET || token === process.env.HERMES_CRON_SECRET;
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key");
  if (!valid && queryKey !== "seed-demo-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    await query(
      `INSERT INTO brains (id, owner_user_id, name, slug)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = $3, slug = $4`,
      [DEMO_BRAIN_ID, DEMO_OWNER_ID, "Demo Brain", "demo"]
    );
    results.push("✅ demo brain");

    const pages = [
      {
        slug: "pricing-exceptions", title: "Pricing Exceptions", type: "concept",
        content: `# Pricing Exceptions

Process for handling non-standard pricing requests.

## Rules

If a deal is under $50,000 then Sales Manager Alice Chen approves directly. Alice has handled 23 such approvals since March 2026 with a 100% success rate.

If a deal is $100,000 or above then Legal Counsel Bob Martinez must review, and escalation to VP is required. Bob has handled 8 of these escalations — every single one required his signoff despite no written policy.

If a deal falls between $50,000 and $100,000 then there is no documented process. This is a known gap that causes confusion.

## People

Alice Chen is the Sales Manager who owns the standard approval process. She can be reached at @alice on Slack.

Bob Martinez is the Legal Counsel who reviews all large deals. His email is bob@company.com.

Carol White is the Finance Manager who must be informed on all escalated pricing decisions.

## Exceptions

Enterprise tier customers may bypass the standard process with VP approval. An annual contract renewal under $50K must still go through Alice unless it is an enterprise tier customer with an override.

## Precedents

Acme Corp $45K deal was approved by Alice on 2026-03-15.
Beta Inc $120K deal required Bob's review and VP sign-off on 2026-03-22.
Gamma LLC $38K was approved by Alice on 2026-04-01.
Delta Co $150K required Bob review plus Carol's Finance check on 2026-04-10, approved after escalation.`,
      },
      {
        slug: "refund-policy", title: "Refund Policy", type: "concept",
        content: `# Refund Policy

Process for handling customer refund requests.

## Rules

If a refund is under $10,000 then Customer Success handles initial triage and approval directly. 45 standard refunds were processed this way in Q1 2026.

If a refund is over $10,000 then Finance Manager Carol White must approve. Carol has approved 12 such refunds since January 2026.

If a refund exceeds $25,000 then Carol's direct sign-off is required, despite the official policy only stating a $10,000 threshold. This unwritten rule has been consistently enforced across 12 large refunds.

If the cancellation is within 30 days of an annual plan purchase then a full refund is issued with no questions asked.

## People

Carol White is the Finance Manager who owns the refund approval process. Her email is carol@company.com.

The Customer Success Team handles standard refunds under $10,000. They are a rotating team of 6 reps.

## Precedents

A $200 standard refund was approved by CS on 2026-01-10.
A $15K partial refund required Carol's approval on 2026-02-05.
A $30K refund was escalated to Carol and VP on 2026-03-18.
An enterprise annual refund was processed within the 30-day window on 2026-04-05.`,
      },
      {
        slug: "alice-chen", title: "Alice Chen", type: "person",
        content: `# Alice Chen

Role: Sales Manager on the Enterprise Sales team. Slack: @alice. Location: San Francisco.

Alice owns the standard pricing exception process. If a deal is under $50,000 then Alice approves it directly. For larger deals, she initiates the escalation workflow to Bob Martinez in Legal. Alice has approved 23 pricing exceptions in Q1 2026.`,
      },
      {
        slug: "bob-martinez", title: "Bob Martinez", type: "person",
        content: `# Bob Martinez

Role: Legal Counsel on the Legal & Compliance team. Email: bob@company.com. Location: New York.

Bob reviews all deals over the $100,000 threshold. If a deal is $100,000 or above then Bob must approve before it can proceed. He determines whether escalation to VP is needed. Bob has handled 8 large-deal reviews in Q1 2026.`,
      },
      {
        slug: "carol-white", title: "Carol White", type: "person",
        content: `# Carol White

Role: Finance Manager on the Finance team. Email: carol@company.com. Location: Chicago.

Carol handles all refund approvals over $10,000. If a refund exceeds $25,000 then Carol's direct sign-off is required. She is also informed on escalated pricing decisions. Carol has approved 12 large refunds and been involved in 3 VP escalations in Q1 2026.`,
      },
      {
        slug: "enterprise-tier", title: "Enterprise Tier", type: "concept",
        content: `# Enterprise Tier

Enterprise customers have custom pricing, SSO, audit logs, and dedicated support. Enterprise tier customers may bypass the standard pricing exception process with VP approval. This override applies to renewals, expansions, and custom feature requests.`,
      },
      {
        slug: "customer-success", title: "Customer Success Team", type: "concept",
        content: `# Customer Success Team

The Customer Success team handles standard refunds under $10,000 directly. If a refund is under $10,000 then CS approves it without escalation. For larger refunds, CS routes the request to Finance for Carol White's review. The team has 6 rotating reps.`,
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
    results.push(`✅ ${pages.length} pages`);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("[seed-demo]", err);
    return NextResponse.json(
      { error: "Seed failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
