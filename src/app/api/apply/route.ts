import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/supabase/client";
import { ensureCollaborationSchema } from "@/lib/db-setup";

export async function POST(req: NextRequest) {
  try {
    await ensureCollaborationSchema();
    const body = await req.json();
    const { name, email, company, team_size, message } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO applications (name, email, company, team_size, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, company || null, team_size || null, message || null]
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[brainbase] Application submission error:", err);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
