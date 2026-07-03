import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pollId = request.nextUrl.searchParams.get("poll_id");
  if (!pollId) {
    return NextResponse.json({ error: "poll_id required" }, { status: 400 });
  }

  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%dT%H:%M:00', created_at) as minute, COUNT(*) as count
    FROM votes
    WHERE poll_id = ? AND created_at > datetime('now', '-30 minutes')
    GROUP BY minute
    ORDER BY minute
  `).all(pollId) as { minute: string; count: number }[];

  return NextResponse.json({ data: rows });
}
