/**
 * GET /api/provision/install — serves the bash installer as text/plain.
 *
 * Usage:
 *   curl -fsSL https://brainbase.belweave.ai/api/provision/install | sh
 *
 * The script POSTs to /api/provision and writes the returned credentials
 * to ~/.brainbase/. See scripts/provision.sh for the source.
 */

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

let cached: { body: string; etag: string } | null = null;

function loadScript(): { body: string; etag: string } {
  if (cached) return cached;
  const path = join(process.cwd(), "scripts", "provision.sh");
  const body = readFileSync(path, "utf8");
  // Tiny etag — content hash via length+first/last bytes is enough for cache
  const etag = `W/"${body.length}-${body.charCodeAt(0)}-${body.charCodeAt(body.length - 1)}"`;
  cached = { body, etag };
  return cached;
}

export function GET() {
  try {
    const { body, etag } = loadScript();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/x-shellscript; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        ETag: etag,
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "install_script_unavailable", message: err?.message },
      { status: 500 }
    );
  }
}
