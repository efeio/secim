import prisma from "./prisma";
import crypto from "crypto";

export interface Poll {
  id: string;
  title: string;
  country: string;
  status: "draft" | "active" | "ended";
  created_at: string;
  ended_at: string | null;
}

export interface Candidate {
  id: string;
  poll_id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
}

export interface VoteRecord {
  id: string;
  poll_id: string;
  candidate_id: string;
  province_code: string;
  device_token: string;
  ip_hash: string;
  created_at: string;
}

export interface CandidateResult {
  candidate_id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
  votes: number;
}

export interface ProvinceResult {
  province_code: string;
  leader_candidate_id: string | null;
  leader_color: string | null;
  counts: Record<string, number>;
  total: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

const IP_HASH_SALT = process.env.IP_HASH_SALT;

if (process.env.NODE_ENV === "production" && !IP_HASH_SALT) {
  throw new Error("CRITICAL CONFIGURATION ERROR: IP_HASH_SALT environment variable is not defined in production!");
}

export function hashIP(ip: string): string {
  const salt = IP_HASH_SALT || "secim-2026-salt";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 32);
}

// --- Fraud Prevention ---

export async function checkDuplicateVote(pollId: string, deviceToken: string, ipHash: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const byDevice = await prisma.vote.findFirst({
      where: { pollId, deviceToken },
    });
    if (byDevice) {
      return { blocked: true, reason: "Bu cihazdan zaten oy kullanılmış." };
    }

    const byIp = await prisma.vote.findFirst({
      where: { pollId, ipHash },
    });
    if (byIp) {
      return { blocked: true, reason: "Bu ağdan zaten oy kullanılmış." };
    }

    return { blocked: false };
  } catch (error) {
    console.error("Duplicate check error:", error);
    return { blocked: false };
  }
}

// --- Poll CRUD ---

export async function createPoll(title: string, candidates: { name: string; color: string; color2?: string; photo_url?: string }[], country: string = "tr") {
  const poll = await prisma.poll.create({
    data: {
      id: generateId(),
      title,
      country,
      status: "draft",
      candidates: {
        create: candidates.map((c) => ({
          id: generateId(),
          name: c.name,
          color: c.color,
          color2: c.color2 || null,
          photoUrl: c.photo_url || null,
        })),
      },
    },
    include: {
      candidates: true,
    },
  });

  return {
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
  };
}

export async function getAllPolls() {
  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      candidates: true,
      _count: {
        select: { votes: true },
      },
    },
  });

  return polls.map((poll) => ({
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
    vote_count: poll._count.votes,
  }));
}

export async function getEndedPolls() {
  const polls = await prisma.poll.findMany({
    where: { status: "ended" },
    orderBy: { endedAt: "desc" },
    include: {
      candidates: true,
      _count: {
        select: { votes: true },
      },
    },
  });

  return polls.map((poll) => ({
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
    vote_count: poll._count.votes,
  }));
}

export async function getPollById(pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { candidates: true },
  });
  if (!poll) return null;
  return {
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
  };
}

export async function getActivePoll() {
  const poll = await prisma.poll.findFirst({
    where: { status: "active" },
    include: { candidates: true },
  });
  if (!poll) return null;
  return {
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
  };
}

export async function startPoll(pollId: string): Promise<void> {
  await prisma.poll.update({
    where: { id: pollId },
    data: { status: "active" },
  });
}

export async function getActivePolls() {
  const polls = await prisma.poll.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    include: {
      candidates: true,
      _count: {
        select: { votes: true },
      },
    },
  });

  return polls.map((poll) => ({
    id: poll.id,
    title: poll.title,
    country: poll.country,
    status: poll.status as "draft" | "active" | "ended",
    created_at: poll.createdAt.toISOString(),
    ended_at: poll.endedAt ? poll.endedAt.toISOString() : null,
    candidates: poll.candidates.map((c) => ({
      id: c.id,
      poll_id: c.pollId,
      name: c.name,
      color: c.color,
      color2: c.color2,
      photo_url: c.photoUrl,
    })),
    vote_count: poll._count.votes,
  }));
}

export async function endPoll(pollId: string): Promise<void> {
  await prisma.poll.update({
    where: { id: pollId },
    data: { status: "ended", endedAt: new Date() },
  });
}

export async function deletePoll(pollId: string): Promise<void> {
  await prisma.poll.delete({
    where: { id: pollId },
  });
}

// --- Voting ---

export async function castVote(pollId: string, candidateId: string, provinceCode: string, deviceToken: string, ipHash: string): Promise<VoteRecord> {
  const normalizedCode = provinceCode.toLowerCase();
  try {
    const vote = await prisma.$transaction(async (tx) => {
      const byDevice = await tx.vote.findFirst({
        where: { pollId, deviceToken },
      });
      if (byDevice) {
        throw new Error("Bu cihazdan zaten oy kullanılmış.");
      }

      const byIp = await tx.vote.findFirst({
        where: { pollId, ipHash },
      });
      if (byIp) {
        throw new Error("Bu ağdan zaten oy kullanılmış.");
      }

      return await tx.vote.create({
        data: {
          id: generateId(),
          pollId,
          candidateId,
          provinceCode: normalizedCode,
          deviceToken,
          ipHash,
        },
      });
    });

    return {
      id: vote.id,
      poll_id: vote.pollId,
      candidate_id: vote.candidateId,
      province_code: vote.provinceCode,
      device_token: vote.deviceToken,
      ip_hash: vote.ipHash,
      created_at: vote.createdAt.toISOString(),
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; meta?: { target?: string[] } };
    if (err.message === "Bu cihazdan zaten oy kullanılmış." || err.message === "Bu ağdan zaten oy kullanılmış.") {
      throw error;
    }
    if (err.code === "P2002") {
      const targets = err.meta?.target || [];
      if (targets.includes("device_token") || targets.includes("deviceToken")) {
        throw new Error("Bu cihazdan zaten oy kullanılmış.");
      } else if (targets.includes("ip_hash") || targets.includes("ipHash")) {
        throw new Error("Bu ağdan zaten oy kullanılmış.");
      } else {
        throw new Error("Bu oylamada zaten oy kullandınız.");
      }
    }
    throw error;
  }
}

// --- Results ---

export async function getCandidateResults(pollId: string): Promise<CandidateResult[]> {
  const candidates = await prisma.candidate.findMany({
    where: { pollId },
  });
  const counts = await prisma.vote.groupBy({
    by: ["candidateId"],
    where: { pollId },
    _count: {
      _all: true,
    },
  });

  const countMap = new Map(counts.map((r) => [r.candidateId, r._count._all]));

  return candidates.map((c) => ({
    candidate_id: c.id,
    name: c.name,
    color: c.color,
    color2: c.color2,
    photo_url: c.photoUrl,
    votes: countMap.get(c.id) || 0,
  }));
}

export async function getProvinceResults(pollId: string): Promise<ProvinceResult[]> {
  const rows = await prisma.vote.groupBy({
    by: ["provinceCode", "candidateId"],
    where: { pollId },
    _count: {
      _all: true,
    },
  });

  const candidates = await prisma.candidate.findMany({
    where: { pollId },
    select: { id: true, color: true },
  });
  const colorMap = new Map(candidates.map((c) => [c.id, c.color]));

  const grouped = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!grouped.has(row.provinceCode)) {
      grouped.set(row.provinceCode, new Map());
    }
    grouped.get(row.provinceCode)!.set(row.candidateId, row._count._all);
  }

  const results: ProvinceResult[] = [];
  for (const [province_code, counts] of grouped) {
    let maxVotes = 0;
    let leaderId: string | null = null;
    let total = 0;
    const countsObj: Record<string, number> = {};

    for (const [candidateId, count] of counts) {
      countsObj[candidateId] = count;
      total += count;
      if (count > maxVotes) {
        maxVotes = count;
        leaderId = candidateId;
      }
    }

    results.push({
      province_code,
      leader_candidate_id: leaderId,
      leader_color: leaderId ? colorMap.get(leaderId) || null : null,
      counts: countsObj,
      total,
    });
  }

  return results;
}

export async function getRecentVotes(pollId: string, limit: number = 25): Promise<(VoteRecord & { candidate_name: string; candidate_color: string })[]> {
  const votes = await prisma.vote.findMany({
    where: { pollId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { candidate: true },
  });

  return votes.map((v) => ({
    id: v.id,
    poll_id: v.pollId,
    candidate_id: v.candidateId,
    province_code: v.provinceCode,
    device_token: v.deviceToken,
    ip_hash: v.ipHash,
    created_at: v.createdAt.toISOString(),
    candidate_name: v.candidate.name,
    candidate_color: v.candidate.color,
  }));
}

export async function getTotalVotes(pollId: string): Promise<number> {
  return await prisma.vote.count({
    where: { pollId },
  });
}

interface IrregularityRow {
  ip_hash: string;
  count: number;
  provinces: string | null;
}

interface VelocityRow {
  minute: string;
  count: number;
}

export async function getIrregularities(pollId: string): Promise<{ ip_hash: string; count: number; provinces: string }[]> {
  const rows = await prisma.$queryRawUnsafe<IrregularityRow[]>(
    `SELECT ip_hash, COUNT(*)::int as count, string_agg(DISTINCT province_code, ',') as provinces
     FROM votes WHERE poll_id = $1
     GROUP BY ip_hash HAVING COUNT(*) > 1
     ORDER BY count DESC LIMIT 50`,
    pollId
  );
  return rows.map((r) => ({
    ip_hash: r.ip_hash,
    count: Number(r.count),
    provinces: r.provinces || "",
  }));
}

export async function getVoteVelocity(pollId: string): Promise<{ minute: string; count: number }[]> {
  const rows = await prisma.$queryRawUnsafe<VelocityRow[]>(
    `SELECT to_char(date_trunc('minute', created_at), 'YYYY-MM-DD"T"HH24:MI:SS') as minute, COUNT(*)::int as count
     FROM votes
     WHERE poll_id = $1 AND created_at > NOW() - INTERVAL '30 minutes'
     GROUP BY date_trunc('minute', created_at)
     ORDER BY minute`,
     pollId
  );
  return rows.map((r) => ({
    minute: r.minute,
    count: Number(r.count),
  }));
}
