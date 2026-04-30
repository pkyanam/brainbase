/**
 * CLI runner for the Brainbase Dream Cycle.
 * Usage: npx tsx scripts/dream-cycle.ts [brain_id]
 */

import { runDreamCycle } from "../src/lib/dream-cycle";

const brainId = process.argv[2] || "00000000-0000-0000-0000-000000000001";

async function main() {
  console.log(`[dream] Starting dream cycle for brain ${brainId}...`);
  const report = await runDreamCycle(brainId);
  console.log("[dream] Report:", JSON.stringify(report, null, 2));
  process.exit(report.status === "failed" ? 1 : 0);
}

main().catch(err => {
  console.error("[dream] Fatal error:", err);
  process.exit(1);
});
