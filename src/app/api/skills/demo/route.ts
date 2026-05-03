import { NextRequest, NextResponse } from "next/server";
import { generateSkillsFile } from "@/lib/skills-generator";

/**
 * GET /api/skills/demo?task=<task>
 *
 * Public demo endpoint — no auth required. Queries an isolated public
 * demo brain using the real skills generator.
 *
 * The demo brain is pre-seeded with 7 synthetic pages (pricing exceptions,
 * refund policy, Alice Chen, Bob Martinez, etc.).
 */
const DEMO_BRAIN_ID = "d3e00000-0000-4000-a000-000000000001";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const task = url.searchParams.get("task") || "";

  if (!task) {
    return NextResponse.json(
      { error: "Missing 'task' query parameter. Try ?task=pricing+exceptions" },
      { status: 400 }
    );
  }

  try {
    const skillsFile = await generateSkillsFile(DEMO_BRAIN_ID, task);

    if (skillsFile.confidence === 0 && skillsFile.people.length === 0 && skillsFile.rules.length === 0) {
      return NextResponse.json({
        ...skillsFile,
        _note: "No matching pages found in demo brain. Try: pricing exceptions, refund policy, alice chen, bob martinez, carol white, enterprise tier, or customer success.",
      });
    }

    return NextResponse.json(skillsFile);
  } catch (err) {
    console.error("[brainbase] Demo skills generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate skills file from demo brain" },
      { status: 500 }
    );
  }
}
