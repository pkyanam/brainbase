import { NextRequest, NextResponse } from "next/server";
import { queryOne, queryMany, query } from "@/lib/supabase/client";

/**
 * POST /api/admin/fix-demo-leak
 * Fix the demo brain collision by renaming the real brain back
 * and creating a genuine isolated demo brain with a fresh UUID.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (key !== "fix-demo-leak-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];
  const BAD_ID = "00000000-0000-0000-0000-000000000001";
  const NEW_DEMO_ID = "d3e00000-0000-4000-a000-000000000001";

  try {
    // 1. Find the real brain that got renamed
    const badBrain = await queryOne<{ id: string; owner_user_id: string; name: string }>(
      `SELECT id, owner_user_id, name FROM brains WHERE id = $1 LIMIT 1`,
      [BAD_ID]
    );

    if (badBrain) {
      // 2. Rename it back
      await query(
        `UPDATE brains SET name = 'My Brain', slug = $1 WHERE id = $2`,
        [badBrain.owner_user_id.slice(0, 8), BAD_ID]
      );
      results.push(`✅ Renamed brain ${BAD_ID.slice(0, 8)}... back to "My Brain"`);

      // 3. Delete the 7 demo pages from the real brain
      const demoSugs = ["pricing-exceptions", "alice-chen", "bob-martinez", "carol-white", "refund-policy", "enterprise-tier", "customer-success"];
      for (const slug of demoSugs) {
        await query(`DELETE FROM pages WHERE brain_id = $1 AND slug = $2`, [BAD_ID, slug]);
      }
      results.push(`✅ Removed ${demoSugs.length} demo pages from real brain`);
    }

    // 4. Create new isolated demo brain
    await query(
      `INSERT INTO brains (id, owner_user_id, name, slug)
       VALUES ($1, 'demo-system', 'Demo Brain', 'demo')
       ON CONFLICT (id) DO NOTHING`,
      [NEW_DEMO_ID]
    );
    results.push(`✅ Created isolated demo brain: ${NEW_DEMO_ID}`);

    // 5. Seed demo pages into the new brain
    const pages = [
      { slug: "pricing-exceptions", title: "Pricing Exceptions", type: "concept",
        content: `# Pricing Exceptions

Process for handling non-standard pricing requests.

## Rules
If a deal is under $50,000 then Sales Manager Alice Chen approves directly.
If a deal is $100,000 or above then Legal Counsel Bob Martinez must review, and escalation to VP is required.

## People
Alice Chen is the Sales Manager. Slack: @alice.
Bob Martinez is the Legal Counsel. Email: bob@company.com.
Carol White is the Finance Manager, informed on escalated decisions.` },
      { slug: "alice-chen", title: "Alice Chen", type: "person",
        content: `# Alice Chen\nRole: Sales Manager. Slack: @alice. Approves deals under $50K. 23 precedents in Q1 2026.` },
      { slug: "bob-martinez", title: "Bob Martinez", type: "person",
        content: `# Bob Martinez\nRole: Legal Counsel. Email: bob@company.com. Reviews deals over $100K. 8 escalations in Q1 2026.` },
      { slug: "carol-white", title: "Carol White", type: "person",
        content: `# Carol White\nRole: Finance Manager. Email: carol@company.com. Approves refunds over $10K.` },
      { slug: "refund-policy", title: "Refund Policy", type: "concept",
        content: `# Refund Policy\n\nIf a refund is under $10,000 then Customer Success handles approval.\nIf a refund is over $10,000 then Finance Manager Carol White must approve.\nIf a refund exceeds $25,000 then Carol's direct sign-off is required.` },
      { slug: "enterprise-tier", title: "Enterprise Tier", type: "concept",
        content: `# Enterprise Tier\nEnterprise customers may bypass standard pricing exception process with VP approval.` },
      { slug: "customer-success", title: "Customer Success Team", type: "concept",
        content: `# Customer Success Team\nHandles standard refunds under $10K. Routes larger refunds to Finance.` },
    ];

    for (const page of pages) {
      await query(
        `INSERT INTO pages (brain_id, slug, title, type, compiled_truth, search_vector, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, to_tsvector('english', $5), NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [NEW_DEMO_ID, page.slug, page.title, page.type, page.content]
      );
    }
    results.push(`✅ Seeded ${pages.length} pages into isolated demo brain`);

    // 6. Verify isolation
    const demoCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM pages WHERE brain_id = $1`,
      [NEW_DEMO_ID]
    );
    results.push(`✅ Demo brain has ${demoCount?.count || 0} pages (should be ${pages.length})`);

    const realCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM pages WHERE brain_id = $1`,
      [BAD_ID]
    );
    results.push(`✅ Real brain has ${realCount?.count || 0} pages`);

    return NextResponse.json({ success: true, new_demo_id: NEW_DEMO_ID, results });
  } catch (err) {
    return NextResponse.json(
      { error: "Fix failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
