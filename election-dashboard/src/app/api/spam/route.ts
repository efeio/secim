import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { castVote, getPollById } from "@/lib/election";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const { poll_id, candidate_id, province_code } = await request.json();
    if (!poll_id || !candidate_id || !province_code) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    const fakeDeviceToken = crypto.randomUUID();
    const fakeIp = `spam-ip-${crypto.randomUUID()}`;
    const fakeIpHash = crypto.createHash("sha256").update(fakeIp).digest("hex").slice(0, 32);

    const vote = await castVote(poll_id, candidate_id, province_code, fakeDeviceToken, fakeIpHash);

    const { eventBus } = await import("@/lib/events");
    const poll = await getPollById(poll_id);
    const candidate = poll?.candidates.find((c) => c.id === candidate_id);

    eventBus.emit({
      type: "new_vote",
      poll_id,
      vote: {
        id: vote.id,
        poll_id: vote.poll_id,
        candidate_id: vote.candidate_id,
        candidate_name: candidate?.name || "Bilinmeyen Aday",
        candidate_color: candidate?.color || "#888888",
        province_code: vote.province_code,
        created_at: vote.created_at,
      },
    });

    return NextResponse.json({ success: true, vote_id: vote.id });
  } catch (error: unknown) {
    console.error("Spam vote casting error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sistem hatası." },
      { status: 500 }
    );
  }
}
