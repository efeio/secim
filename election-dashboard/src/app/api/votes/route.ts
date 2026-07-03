import { NextRequest, NextResponse } from "next/server";
import { getActivePoll, getCandidateResults, getProvinceResults, getTotalVotes, getPollById } from "@/lib/election";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const pollId = request.nextUrl.searchParams.get("poll_id");

    if (pollId) {
      const poll = await getPollById(pollId);
      if (!poll) return NextResponse.json({ error: "Oylama bulunamadı." }, { status: 404 });

      const candidateResults = await getCandidateResults(poll.id);
      const provinceResults = await getProvinceResults(poll.id);
      const totalVotes = await getTotalVotes(poll.id);

      return NextResponse.json({
        active: poll.status === "active",
        poll: { id: poll.id, title: poll.title, country: poll.country, status: poll.status, candidates: poll.candidates, ended_at: poll.ended_at },
        candidateResults,
        provinceResults,
        totalVotes,
      });
    }

    const activePoll = await getActivePoll();
    if (!activePoll) {
      return NextResponse.json({ active: false, poll: null });
    }

    const candidateResults = await getCandidateResults(activePoll.id);
    const provinceResults = await getProvinceResults(activePoll.id);
    const totalVotes = await getTotalVotes(activePoll.id);

    return NextResponse.json({
      active: true,
      poll: { id: activePoll.id, title: activePoll.title, country: activePoll.country, status: activePoll.status, candidates: activePoll.candidates },
      candidateResults,
      provinceResults,
      totalVotes,
    });
  } catch (error) {
    console.error("Votes fetch error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
