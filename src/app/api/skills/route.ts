import { NextRequest, NextResponse } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";
import { generateSkillsFile } from "@/lib/skills-generator";

/**
 * POST /api/skills
 * Generate a skills file for a given task.
 *
 * Body: { task: string }
 * Query: ?brain_id=<uuid> (optional, defaults to user's brain)
 *
 * Returns: SkillsFile JSON
 */
export async function POST(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const task = body.task || "";

    if (!task || typeof task !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'task' field" },
        { status: 400 }
      );
    }

    const skillsFile = await generateSkillsFile(auth.brainId, task);
    return NextResponse.json(skillsFile);
  } catch (err) {
    console.error("[brainbase] Skills generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate skills file" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/skills?task=<task>
 * Alternative for simple GET requests.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const task = url.searchParams.get("task") || "";

  if (!task) {
    return NextResponse.json(
      { error: "Missing 'task' query parameter" },
      { status: 400 }
    );
  }

  try {
    const skillsFile = await generateSkillsFile(auth.brainId, task);
    return NextResponse.json(skillsFile);
  } catch (err) {
    console.error("[brainbase] Skills generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate skills file" },
      { status: 500 }
    );
  }
}
