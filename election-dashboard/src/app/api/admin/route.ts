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

  const polls = await getAllPolls();
  const activePoll = await getActivePoll();

  let activeAnalytics = null;
  if (activePoll) {
    activeAnalytics = {
      candidateResults: await getCandidateResults(activePoll.id),
      provinceResults: await getProvinceResults(activePoll.id),
      irregularities: await getIrregularities(activePoll.id),
      totalVotes: await getTotalVotes(activePoll.id),
    };
  }

  const auditLogs = await getAuditLogs(100);

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
      const poll = await createPoll(data.title.trim(), data.candidates.map((c: { name: string; color: string; color2?: string; photo_url?: string }) => ({
        name: c.name.trim(),
        color: c.color,
        color2: c.color2 || undefined,
        photo_url: c.photo_url || undefined,
      })), data.country || "tr");
      await logAudit("poll_created", "admin", { poll_id: poll.id, title: data.title, country: data.country });
      return NextResponse.json({ success: true, poll });
    }

    case "start_poll": {
      await startPoll(data.poll_id);
      await logAudit("poll_started", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "started", poll_id: data.poll_id });
      return NextResponse.json({ success: true });
    }

    case "end_poll": {
      await endPoll(data.poll_id);
      await logAudit("poll_ended", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "ended", poll_id: data.poll_id, status: "ended" });
      return NextResponse.json({ success: true });
    }

    case "delete_poll": {
      await deletePoll(data.poll_id);
      await logAudit("poll_deleted", "admin", { poll_id: data.poll_id });
      eventBus.emit({ type: "poll_changed", action: "deleted", poll_id: data.poll_id });
      return NextResponse.json({ success: true });
    }
  }
}
