import { NextRequest } from "next/server";
import { requireBrainAccess } from "@/lib/auth-guard";

/**
 * v0.3 — Server-Sent Events endpoint for live brain updates.
 * Works on Vercel edge: keeps connection open, streams events.
 */
export async function GET(req: NextRequest) {
  const auth = await requireBrainAccess(req);
  if (auth instanceof Response) return auth;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`event: connected\ndata: {"brain_id":"${auth.brainId}"}\n\n`));

      // Keep-alive every 15s
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, 15000);

      // Close on client disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
