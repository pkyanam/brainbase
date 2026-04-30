import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { searchBrain } from "@/lib/supabase/search";
import { getPage, getTimeline } from "@/lib/supabase/pages";

interface ImplicitRule {
  observation: string;
  evidence: string;
  confidence: number;
  page_slug: string;
  page_title: string;
}

/**
 * GET /api/brain/implicit-rules
 * Scan the brain for unwritten rules — repeated patterns with no explicit doc source.
 *
 * Query: ?brain_id=<uuid>
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    const start = Date.now();
    const rules: ImplicitRule[] = [];

    // Strategy: search for policy/process/decision pages, check timeline density
    // vs explicit documentation. High precedent count + low explicit rule count = implicit.
    const seeds = await searchBrain(auth.brainId, "policy process decision rule approval", 20);

    for (const seed of seeds) {
      const page = await getPage(auth.brainId, seed.slug);
      if (!page) continue;

      const timeline = await getTimeline(auth.brainId, seed.slug);
      if (timeline.length < 3) continue; // Need precedents to detect a pattern

      const content = page.content.toLowerCase();
      const hasExplicitRule =
        content.includes("if ") ||
        content.includes("must ") ||
        content.includes("required") ||
        content.includes("policy") ||
        content.includes("process");

      if (!hasExplicitRule && timeline.length >= 3) {
        // Repeated decisions but no explicit rule documented
        const outcomes = timeline.map((t) => t.summary.toLowerCase());
        const commonOutcome = findMostCommon(outcomes);
        if (commonOutcome.count >= 3) {
          rules.push({
            observation: `Unwritten pattern in "${page.title}": decisions consistently trend toward "${commonOutcome.value.slice(0, 80)}"`,
            evidence: `${timeline.length} precedents, no explicit policy documented. Most common outcome: ${commonOutcome.count} occurrences.`,
            confidence: Math.min(0.95, 0.5 + timeline.length * 0.05),
            page_slug: seed.slug,
            page_title: page.title,
          });
        }
      }

      // Detect threshold gaps (documented rules with missing ranges)
      const thresholdMatches = page.content.match(/\$[\d,.]+[KkMm]?\+?\s*(threshold|limit|cap|minimum|maximum)/gi);
      if (thresholdMatches && thresholdMatches.length >= 2) {
        const vals = thresholdMatches
          .map((m) => {
            const num = m.match(/\$([\d,.]+)([KkMm])?/);
            if (!num) return null;
            let v = parseFloat(num[1].replace(/,/g, ""));
            if (num[2]?.toLowerCase() === "k") v *= 1000;
            if (num[2]?.toLowerCase() === "m") v *= 1000000;
            return v;
          })
          .filter(Boolean) as number[];

        vals.sort((a, b) => a - b);
        for (let i = 0; i < vals.length - 1; i++) {
          const gap = vals[i + 1] - vals[i];
          if (gap > vals[i] * 0.5) {
            rules.push({
              observation: `Gap in documented thresholds for "${page.title}": no process defined between $${fmt(vals[i])} and $${fmt(vals[i + 1])}`,
              evidence: `${thresholdMatches.length} thresholds found, but coverage is non-continuous`,
              confidence: 0.78,
              page_slug: seed.slug,
              page_title: page.title,
            });
          }
        }
      }
    }

    // Deduplicate by observation
    const seen = new Set<string>();
    const deduped = rules.filter((r) => {
      if (seen.has(r.observation)) return false;
      seen.add(r.observation);
      return true;
    });

    deduped.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      rules: deduped.slice(0, 10),
      scanned: seeds.length,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    console.error("[brainbase] Implicit rules scan error:", err);
    return NextResponse.json(
      { error: "Failed to scan for implicit rules" },
      { status: 500 }
    );
  }
}

function findMostCommon(arr: string[]): { value: string; count: number } {
  const counts = new Map<string, number>();
  for (const s of arr) {
    const key = s.slice(0, 60);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = { value: "", count: 0 };
  for (const [value, count] of counts) {
    if (count > best.count) best = { value, count };
  }
  return best;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
