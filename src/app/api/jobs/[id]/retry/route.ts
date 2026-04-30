import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { getJob, retryJob } from "@/lib/minions/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (isNaN(jobId)) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  try {
    const existing = await getJob(jobId);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing.brain_id && existing.brain_id !== auth.brainId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!["failed", "dead"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot retry job in '${existing.status}' status` },
        { status: 409 }
      );
    }

    const job = await retryJob(jobId);
    return NextResponse.json({ job });
  } catch (err) {
    console.error("[brainbase] POST /api/jobs/[id]/retry error:", err);
    return NextResponse.json({ error: "Failed to retry job" }, { status: 500 });
  }
}
