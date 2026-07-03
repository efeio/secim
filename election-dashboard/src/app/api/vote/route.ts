import { NextRequest, NextResponse } from "next/server";
import { castVote, checkDuplicateVote, getPollById, hashIP } from "@/lib/election";
import { eventBus } from "@/lib/events";
import { VoteRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/ratelimit";
import { getRegions } from "@/lib/regions/index";
import { isChallengeIssued, verifyPoW, markChallengeUsed } from "@/lib/pow";

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

    const {
      candidate_id,
      province_code,
      poll_id,
      device_token,
      pow_challenge,
      pow_nonce,
      turnstile_token,
    } = parsed.data;

    const poll = await getPollById(poll_id);
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
    const clientIp = ip.split(",")[0].trim();
    const ipHash = hashIP(clientIp);

    const isAntibotSkipped = process.env.SKIP_ANTIBOT_CHECKS === "true" && process.env.NODE_ENV !== "production";

    if (!isAntibotSkipped) {
      if (!pow_challenge || pow_nonce === undefined || !turnstile_token) {
        return NextResponse.json({ error: "Güvenlik doğrulaması eksik." }, { status: 400 });
      }

      // Check if challenge was issued
      if (!await isChallengeIssued(pow_challenge)) {
        return NextResponse.json({ error: "Geçersiz veya süresi dolmuş güvenlik kodu (PoW)." }, { status: 400 });
      }

      // Verify PoW
      if (!verifyPoW(pow_challenge, pow_nonce, 5)) {
        return NextResponse.json({ error: "Güvenlik doğrulaması başarısız (PoW)." }, { status: 400 });
      }

      // Mark challenge as used (replay protection)
      if (!await markChallengeUsed(pow_challenge)) {
        return NextResponse.json({ error: "Bu güvenlik kodu zaten kullanılmış." }, { status: 400 });
      }

      // Verify Turnstile
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (!turnstileSecret) {
        console.error("TURNSTILE_SECRET_KEY is not configured!");
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json({ error: "Sistem yapılandırma hatası." }, { status: 500 });
        }
      } else {
        try {
          const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstile_token,
              remoteip: clientIp,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyData.success) {
            return NextResponse.json({ error: "Robot doğrulaması başarısız (Turnstile)." }, { status: 400 });
          }
        } catch (err) {
          console.error("Turnstile verify error:", err);
          return NextResponse.json({ error: "Robot doğrulaması servisi yanıt vermiyor." }, { status: 500 });
        }
      }
    }

    const rateResult = await checkRateLimit(ipHash);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Çok sık deniyorsunuz, lütfen bekleyin." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.reset - Date.now()) / 1000)) } }
      );
    }

    const dupCheck = await checkDuplicateVote(poll.id, device_token, ipHash);
    if (dupCheck.blocked) {
      return NextResponse.json({ error: dupCheck.reason }, { status: 429 });
    }

    const vote = await castVote(poll.id, candidate_id, province_code, device_token, ipHash);

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
