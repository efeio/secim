import { NextResponse } from "next/server";
import { getActivePolls, getCandidateResults, getTotalVotes } from "@/lib/election";

export async function GET() {
  const polls = getActivePolls();

  const enriched = polls.map((poll) => {
    const results = getCandidateResults(poll.id);
    const totalVotes = getTotalVotes(poll.id);
    const sorted = [...results].sort((a, b) => b.votes - a.votes);
    const leader = sorted[0] || null;

    return {
      id: poll.id,
      title: poll.title,
      country: poll.country,
      totalVotes,
      candidates: results,
      leader: leader ? { name: leader.name, color: leader.color, pct: totalVotes > 0 ? ((leader.votes / totalVotes) * 100).toFixed(1) : "0" } : null,
    };
  });

  return NextResponse.json(enriched);
}
