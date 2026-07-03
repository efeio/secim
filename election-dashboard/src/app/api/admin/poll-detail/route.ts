import { NextRequest, NextResponse } from "next/server";
import { getCandidateResults, getProvinceResults, getIrregularities, getTotalVotes } from "@/lib/election";

import { checkAdminAuth } from "@/lib/adminAuth";

if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PIN) {
  throw new Error("CRITICAL CONFIGURATION ERROR: ADMIN_PIN environment variable is not defined in production!");
}

function checkAuth(request: NextRequest): boolean {
  return checkAdminAuth(request);
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const pollId = request.nextUrl.searchParams.get("poll_id");
  if (!pollId) {
    return NextResponse.json({ error: "poll_id gerekli." }, { status: 400 });
  }

  const candidateResults = await getCandidateResults(pollId);
  const provinceResults = await getProvinceResults(pollId);
  const irregularities = await getIrregularities(pollId);
  const totalVotes = await getTotalVotes(pollId);

  return NextResponse.json({
    candidateResults,
    provinceResults,
    irregularities,
    totalVotes,
  });
}
