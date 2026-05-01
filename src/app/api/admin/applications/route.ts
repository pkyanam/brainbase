import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-guard";
import { queryMany } from "@/lib/supabase/client";
import { ensureApplicationsTable } from "@/lib/db-setup";

/**
 * GET /api/admin/applications
 *
 * List all design partner applications. Owner-only.
 *
 * Query params:
 *   ?limit=N (default 50)
 *   ?offset=N (default 0)
 */
export async function GET(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof Response) return auth;

  await ensureApplicationsTable();

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const applications = await queryMany<{
      id: string;
      name: string;
      email: string;
      company: string | null;
      team_size: string | null;
      message: string | null;
      source: string;
      created_at: string;
    }>(
      `SELECT id, name, email, company, team_size, message, source, created_at
       FROM applications
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRow = await queryMany<{ count: number }>(
      `SELECT COUNT(*) as count FROM applications`
    );

    return NextResponse.json({
      applications,
      total: countRow[0]?.count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[brainbase] Failed to fetch applications:", err);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}
