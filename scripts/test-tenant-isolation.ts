#!/usr/bin/env tsx
/**
 * Test multi-tenant isolation between Brain 1 and Brain 2.
 * Run: npx tsx scripts/test-tenant-isolation.ts
 */

import { putPage, listPages, deletePage } from "../src/lib/supabase/write";
import { getPage } from "../src/lib/supabase/pages";

const BRAIN_1 = "00000000-0000-0000-0000-000000000001";
const BRAIN_2 = "ee67df90-e944-4419-807d-ca1c36a3d057";
const TEST_SLUG = "test-tenant-isolation-page";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("=".repeat(60));
  console.log("MULTI-TENANT ISOLATION TEST");
  console.log("=".repeat(60));
  console.log(`Brain 1: ${BRAIN_1}`);
  console.log(`Brain 2: ${BRAIN_2}`);
  console.log(`Test slug: ${TEST_SLUG}`);
  console.log();

  // Clean up any existing test page
  console.log("[1/8] Cleaning up existing test page...");
  await deletePage(BRAIN_1, TEST_SLUG).catch(() => {});
  await deletePage(BRAIN_2, TEST_SLUG).catch(() => {});
  await sleep(500);

  // Write to Brain 2
  console.log("[2/8] Writing page to Brain 2...");
  const brain2Page = await putPage(BRAIN_2, {
    slug: TEST_SLUG,
    title: "Brain 2 Secret Page",
    type: "concept",
    content: "This page should ONLY be visible to Brain 2 tenants.",
  });
  console.log(`  ✅ Created: ${brain2Page.slug} in Brain 2`);

  // Verify Brain 2 can see it
  console.log("[3/8] Reading page from Brain 2...");
  const fromBrain2 = await getPage(BRAIN_2, TEST_SLUG);
  if (fromBrain2) {
    console.log(`  ✅ Brain 2 CAN see the page: "${fromBrain2.title}"`);
  } else {
    console.log("  ❌ FAIL: Brain 2 cannot see its own page!");
    process.exit(1);
  }

  // Verify Brain 1 CANNOT see it
  console.log("[4/8] Reading page from Brain 1 (should be null)...");
  const fromBrain1 = await getPage(BRAIN_1, TEST_SLUG);
  if (!fromBrain1) {
    console.log("  ✅ Brain 1 CANNOT see Brain 2's page (isolation working)");
  } else {
    console.log("  ❌ FAIL: Brain 1 can see Brain 2's page! Isolation broken!");
    console.log(`  Found: "${fromBrain1.title}"`);
    process.exit(1);
  }

  // List pages in Brain 1 — verify test page not there
  console.log("[5/8] Listing pages in Brain 1...");
  const brain1List = await listPages(BRAIN_1, { limit: 1000 });
  const brain1HasIt = brain1List.some((p) => p.slug === TEST_SLUG);
  if (!brain1HasIt) {
    console.log(`  ✅ Brain 1 list does NOT contain test page (${brain1List.length} pages)`);
  } else {
    console.log("  ❌ FAIL: Brain 1 list contains Brain 2's page!");
    process.exit(1);
  }

  // List pages in Brain 2 — verify test page IS there
  console.log("[6/8] Listing pages in Brain 2...");
  const brain2List = await listPages(BRAIN_2, { limit: 1000 });
  const brain2HasIt = brain2List.some((p) => p.slug === TEST_SLUG);
  if (brain2HasIt) {
    console.log(`  ✅ Brain 2 list DOES contain test page (${brain2List.length} pages)`);
  } else {
    console.log("  ❌ FAIL: Brain 2 list missing its own page!");
    process.exit(1);
  }

  // Write same slug to Brain 1 (should be separate)
  console.log("[7/8] Writing same slug to Brain 1 (different content)...");
  const brain1Page = await putPage(BRAIN_1, {
    slug: TEST_SLUG,
    title: "Brain 1 Public Page",
    type: "concept",
    content: "This is Brain 1's version of the page.",
  });
  console.log(`  ✅ Created: ${brain1Page.slug} in Brain 1`);

  // Verify both brains have DIFFERENT content
  console.log("[8/8] Verifying both brains have independent copies...");
  const b1 = await getPage(BRAIN_1, TEST_SLUG);
  const b2 = await getPage(BRAIN_2, TEST_SLUG);
  if (b1?.title === "Brain 1 Public Page" && b2?.title === "Brain 2 Secret Page") {
    console.log("  ✅ Both brains have independent copies with different content");
  } else {
    console.log("  ❌ FAIL: Pages are not independent!");
    console.log(`  Brain 1: "${b1?.title}"`);
    console.log(`  Brain 2: "${b2?.title}"`);
    process.exit(1);
  }

  // Cleanup
  console.log();
  console.log("[Cleanup] Deleting test pages...");
  await deletePage(BRAIN_1, TEST_SLUG);
  await deletePage(BRAIN_2, TEST_SLUG);
  console.log("  ✅ Deleted");

  console.log();
  console.log("=".repeat(60));
  console.log("✅ ALL ISOLATION TESTS PASSED");
  console.log("=".repeat(60));
  console.log();
  console.log("Summary:");
  console.log("  - Brain 2 can write and read its own pages");
  console.log("  - Brain 1 CANNOT see Brain 2's pages");
  console.log("  - Same slug can exist independently in both brains");
  console.log("  - All queries are brain_id-scoped");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
