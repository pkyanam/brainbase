import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { getJob, cancelJob } from "@/lib/minions/queue";

export async function GET(
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
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Tenant isolation: only return if job belongs to this brain
    if (job.brain_id && job.brain_id !== auth.brainId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error("[brainbase] GET /api/jobs/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

export async function DELETE(
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
    // Verify ownership before cancel
    const existing = await getJob(jobId);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing.brain_id && existing.brain_id !== auth.brainId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const job = await cancelJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job already in terminal state" },
        { status: 409 }
      );
    }

    return NextResponse.json({ job });
  } catch (err) {
    console.error("[brainbase] DELETE /api/jobs/[id] error:", err);
    return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
  }
}
