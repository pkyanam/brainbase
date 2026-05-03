import { NextRequest, NextResponse } from "next/server";
import { queryOne, queryMany } from "@/lib/supabase/client";
import { searchBrain } from "@/lib/supabase/search";

const DEMO_BRAIN_ID = "00000000-0000-0000-0000-000000000001";

/**
 * GET /api/admin/diag-demo
 * Diagnostic: check demo brain state and search scope.
 */
export async function GET(req: NextRequest) {
  const results: Record<string, unknown> = {};

  // 1. Check if demo brain exists
  const brain = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM brains WHERE id = $1 LIMIT 1`,
    [DEMO_BRAIN_ID]
  );
  results["brain_exists"] = !!brain;
  if (brain) results["brain_name"] = brain.name;

  // 2. Count demo brain pages
  const pageCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM pages WHERE brain_id = $1`,
    [DEMO_BRAIN_ID]
  );
  results["demo_pages"] = pageCount ? parseInt(pageCount.count) : 0;

  // 3. List demo brain page slugs
  if (pageCount && parseInt(pageCount.count) > 0) {
    const slugs = await queryMany<{ slug: string; title: string }>(
      `SELECT slug, title FROM pages WHERE brain_id = $1 ORDER BY slug LIMIT 20`,
      [DEMO_BRAIN_ID]
    );
    results["demo_slugs"] = slugs.map(r => `${r.slug} (${r.title})`);
  }

  // 4. Test search for "bob martinez" against demo brain
  const searchResults = await searchBrain(DEMO_BRAIN_ID, "bob martinez", 10);
  results["search_count"] = searchResults.length;
  results["search_slugs"] = searchResults.map(r => `${r.slug} (${r.title}, score=${r.score.toFixed(2)}, source=${r.source})`);

  // 5. Test search for "bob martinez" against a NON-EXISTENT brain
  const emptySearch = await searchBrain("ffffffff-ffff-ffff-ffff-ffffffffffff", "bob martinez", 10);
  results["empty_brain_search_count"] = emptySearch.length;

  // 6. Check total pages across ALL brains that match "martinez"
  const allMatch = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM pages WHERE title ILIKE '%martinez%' OR compiled_truth ILIKE '%martinez%'`,
    []
  );
  results["all_brain_martinez_count"] = allMatch ? parseInt(allMatch.count) : 0;

  return NextResponse.json(results);
}
