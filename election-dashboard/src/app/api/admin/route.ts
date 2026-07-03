import { NextRequest, NextResponse } from "next/server";
import {
  createPoll,
  getAllPolls,
  startPoll,
  endPoll,
  deletePoll,
  getActivePoll,
  getCandidateResults,
  getProvinceResults,
  getIrregularities,
  getTotalVotes,
} from "@/lib/election";
import { eventBus } from "@/lib/events";
import { AdminRequestSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/ratelimit";
import { hashIP } from "@/lib/election";
import { logAudit, getAuditLogs } from "@/lib/audit";

const ADMIN_PASSWORD = process.env.ADMIN_PIN || "admin2026";

function checkAuth(request: NextRequest): boolean {
  return request.headers.get("x-admin-key") === ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const polls = getAllPolls();
  const activePoll = getActivePoll();

  let activeAnalytics = null;
  if (activePoll) {
    activeAnalytics = {
      candidateResults: getCandidateResults(activePoll.id),
      provinceResults: getProvinceResults(activePoll.id),
      irregularities: getIrregularities(activePoll.id),
      totalVotes: getTotalVotes(activePoll.id),
    };
  }

  const auditLogs = getAuditLogs(100);

  return NextResponse.json({ polls, activePoll, activeAnalytics, connections: eventBus.connectionCount, auditLogs });
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
  const ipHash = hashIP(ip.split(",")[0].trim());
  const rateResult = await checkRateLimit(ipHash, 10);
  if (!rateResult.success) {
    return NextResponse.json(
      { error: "Çok sık istek gönderiyorsunuz." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.reset - Date.now()) / 1000)) } }
    );
  }

  const body = await request.json();
  const parsed = AdminRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  switch (data.action) {
    case "create_poll": {
      const poll = createPoll(data.title.trim(), data.candidates.map((c: { name: string; color: string; color2?: string; photo_url?: string }) => ({
        name: c.name.trim(),
        color: c.color,
        color2: c.color2 || undefined,
        photo_url: c.photo_url || undefined,
      })), data.country || "tr");
      logAudit("poll_created", "admin", { poll_id: poll.id, title: data.title, country: data.country });
      return NextResponse.json({ success: true, poll });
    }

    case "start_poll": {
      startPoll(data.poll_id);
      logAudit("poll_started", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "started", poll_id: data.poll_id });
      return NextResponse.json({ success: true });
    }

    case "end_poll": {
      endPoll(data.poll_id);
      logAudit("poll_ended", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "ended", poll_id: data.poll_id, status: "ended" });
      return NextResponse.json({ success: true });
    }

    case "delete_poll": {
      deletePoll(data.poll_id);
      logAudit("poll_deleted", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "deleted", poll_id: data.poll_id });
      return NextResponse.json({ success: true });
    }
  }
}
