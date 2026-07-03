import { NextRequest, NextResponse } from "next/server";
import { getCandidateResults, getProvinceResults, getIrregularities, getTotalVotes } from "@/lib/election";

const ADMIN_PASSWORD = process.env.ADMIN_PIN || "admin2026";

function checkAuth(request: NextRequest): boolean {
  return request.headers.get("x-admin-key") === ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const pollId = request.nextUrl.searchParams.get("poll_id");
  if (!pollId) {
    return NextResponse.json({ error: "poll_id gerekli." }, { status: 400 });
  }

  const candidateResults = getCandidateResults(pollId);
  const provinceResults = getProvinceResults(pollId);
  const irregularities = getIrregularities(pollId);
  const totalVotes = getTotalVotes(pollId);

  return NextResponse.json({
    candidateResults,
    provinceResults,
    irregularities,
    totalVotes,
  });
}
