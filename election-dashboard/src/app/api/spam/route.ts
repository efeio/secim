import { NextRequest, NextResponse } from "next/server";
import { castVote, getPollById } from "@/lib/election";
import { eventBus } from "@/lib/events";
import { getRegions } from "@/lib/regions/index";
import crypto from "crypto";

let spamCount = 0;
let spamWindowStart = Date.now();
const SPAM_WINDOW_MS = 1000;
const SPAM_MAX_PER_WINDOW = 100;

export async function POST(request: NextRequest) {
  try {
    const now = Date.now();
    if (now - spamWindowStart > SPAM_WINDOW_MS) {
      spamCount = 0;
      spamWindowStart = now;
    }
    spamCount++;
    if (spamCount > SPAM_MAX_PER_WINDOW) {
      return NextResponse.json({ error: "Spam limiti aşıldı." }, { status: 429 });
    }

    const body = await request.json();
    const { candidate_id, province_code, poll_id } = body;

    if (!poll_id || !candidate_id || !province_code) {
      return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 });
    }

    const poll = getPollById(poll_id);
    if (!poll || poll.status !== "active") {
      return NextResponse.json({ error: "Bu oylama aktif değil." }, { status: 403 });
    }

    const validCandidate = poll.candidates.find((c) => c.id === candidate_id);
    if (!validCandidate) {
      return NextResponse.json({ error: "Geçersiz aday." }, { status: 400 });
    }

    const regions = await getRegions(poll.country || "tr");
    if (!regions.find((r) => r.code === province_code)) {
      return NextResponse.json({ error: "Geçersiz bölge." }, { status: 400 });
    }

    const fakeToken = crypto.randomUUID();
    const fakeIp = crypto.randomUUID().slice(0, 16);

    const vote = castVote(poll.id, candidate_id, province_code, fakeToken, fakeIp);

    eventBus.emit({
      type: "new_vote",
      poll_id: poll.id,
      vote: {
        id: vote.id,
        poll_id: vote.poll_id,
        candidate_id: vote.candidate_id,
        candidate_name: validCandidate.name,
        candidate_color: validCandidate.color,
        province_code: vote.province_code,
        created_at: vote.created_at,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Spam vote error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
