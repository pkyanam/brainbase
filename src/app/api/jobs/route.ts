import { NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/lib/api-auth";
import { submitJob, listJobs, getStats } from "@/lib/minions/queue";

export async function POST(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    data?: Record<string, unknown>;
    queue?: string;
    priority?: number;
    max_attempts?: number;
    delay?: number;
    timeout_ms?: number;
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Missing 'name' field" }, { status: 400 });
  }

  // Only allow built-in job types via API (shell is CLI-only)
  const allowedTypes = ["sync", "embed", "extract", "backlinks"];
  if (!allowedTypes.includes(body.name)) {
    return NextResponse.json(
      { error: `Unknown job type '${body.name}'. Allowed: ${allowedTypes.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const job = await submitJob(body.name, {
      data: body.data,
      queue: body.queue,
      brain_id: auth.brainId,
      priority: body.priority,
      max_attempts: body.max_attempts,
      delay: body.delay,
      timeout_ms: body.timeout_ms,
      idempotency_key: body.idempotency_key,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    console.error("[brainbase] POST /api/jobs error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit job" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = await resolveApiAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const queue = url.searchParams.get("queue") || undefined;
  const name = url.searchParams.get("name") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const [jobs, stats] = await Promise.all([
      listJobs({ status: status as any, queue, name, brain_id: auth.brainId, limit, offset }),
      getStats(),
    ]);

    return NextResponse.json({ jobs, stats });
  } catch (err) {
    console.error("[brainbase] GET /api/jobs error:", err);
    return NextResponse.json({ error: "Failed to list jobs" }, { status: 500 });
  }
}
