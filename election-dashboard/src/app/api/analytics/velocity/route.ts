import { NextRequest, NextResponse } from "next/server";
import { getVoteVelocity } from "@/lib/election";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pollId = request.nextUrl.searchParams.get("poll_id");
  if (!pollId) {
    return NextResponse.json({ error: "poll_id required" }, { status: 400 });
  }

  const rows = await getVoteVelocity(pollId);

  return NextResponse.json({ data: rows });
}
