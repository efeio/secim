import { NextRequest, NextResponse } from "next/server";
import { castVote, checkDuplicateVote, getPollById, hashIP } from "@/lib/election";
import { eventBus } from "@/lib/events";
import { VoteRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/ratelimit";
import { getRegions } from "@/lib/regions/index";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = VoteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Doğrulama hatası.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { candidate_id, province_code, poll_id, device_token } = parsed.data;

    const poll = getPollById(poll_id);
    if (!poll || poll.status !== "active") {
      return NextResponse.json({ error: "Bu oylama aktif değil." }, { status: 403 });
    }

    const regions = await getRegions(poll.country || "tr");
    if (!regions.find((r) => r.code === province_code)) {
      return NextResponse.json({ error: "Geçersiz bölge." }, { status: 400 });
    }

    const validCandidate = poll.candidates.find((c) => c.id === candidate_id);
    if (!validCandidate) {
      return NextResponse.json({ error: "Geçersiz aday." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const ipHash = hashIP(ip.split(",")[0].trim());

    const rateResult = await checkRateLimit(ipHash);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Çok sık deniyorsunuz, lütfen bekleyin." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.reset - Date.now()) / 1000)) } }
      );
    }

    const dupCheck = checkDuplicateVote(poll.id, device_token, ipHash);
    if (dupCheck.blocked) {
      return NextResponse.json({ error: dupCheck.reason }, { status: 429 });
    }

    const vote = castVote(poll.id, candidate_id, province_code, device_token, ipHash);

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

    return NextResponse.json({ success: true, vote_id: vote.id });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
