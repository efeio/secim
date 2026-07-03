import db from "./db";
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

export function hashIP(ip: string): string {
  return crypto.createHash("sha256").update(ip + "secim-2026-salt").digest("hex").slice(0, 32);
}

// --- Fraud Prevention ---

export function checkDuplicateVote(pollId: string, deviceToken: string, ipHash: string): { blocked: boolean; reason?: string } {
  const byDevice = db.prepare(
    "SELECT COUNT(*) as c FROM votes WHERE poll_id = ? AND device_token = ?"
  ).get(pollId, deviceToken) as { c: number };

  if (byDevice.c > 0) {
    return { blocked: true, reason: "Bu cihazdan zaten oy kullanılmış." };
  }

  const byIp = db.prepare(
    "SELECT COUNT(*) as c FROM votes WHERE poll_id = ? AND ip_hash = ?"
  ).get(pollId, ipHash) as { c: number };

  if (byIp.c > 0) {
    return { blocked: true, reason: "Bu ağdan zaten oy kullanılmış." };
  }

  return { blocked: false };
}

// --- Poll CRUD ---

export function createPoll(title: string, candidates: { name: string; color: string; color2?: string; photo_url?: string }[], country: string = "tr"): Poll {
  const pollId = generateId();
  db.prepare("INSERT INTO polls (id, title, country, status) VALUES (?, ?, ?, 'draft')").run(pollId, title, country);

  const stmt = db.prepare("INSERT INTO candidates (id, poll_id, name, color, color2, photo_url) VALUES (?, ?, ?, ?, ?, ?)");
  for (const c of candidates) {
    stmt.run(generateId(), pollId, c.name, c.color, c.color2 || null, c.photo_url || null);
  }

  return db.prepare("SELECT * FROM polls WHERE id = ?").get(pollId) as Poll;
}

export function getAllPolls(): (Poll & { candidates: Candidate[]; vote_count: number })[] {
  const polls = db.prepare("SELECT * FROM polls ORDER BY created_at DESC").all() as Poll[];
  const candidateStmt = db.prepare("SELECT * FROM candidates WHERE poll_id = ?");
  const countStmt = db.prepare("SELECT COUNT(*) as c FROM votes WHERE poll_id = ?");

  return polls.map((poll) => ({
    ...poll,
    candidates: candidateStmt.all(poll.id) as Candidate[],
    vote_count: (countStmt.get(poll.id) as { c: number }).c,
  }));
}

export function getEndedPolls(): (Poll & { candidates: Candidate[]; vote_count: number })[] {
  const polls = db.prepare("SELECT * FROM polls WHERE status = 'ended' ORDER BY ended_at DESC").all() as Poll[];
  const candidateStmt = db.prepare("SELECT * FROM candidates WHERE poll_id = ?");
  const countStmt = db.prepare("SELECT COUNT(*) as c FROM votes WHERE poll_id = ?");

  return polls.map((poll) => ({
    ...poll,
    candidates: candidateStmt.all(poll.id) as Candidate[],
    vote_count: (countStmt.get(poll.id) as { c: number }).c,
  }));
}

export function getPollById(pollId: string): (Poll & { candidates: Candidate[] }) | null {
  const poll = db.prepare("SELECT * FROM polls WHERE id = ?").get(pollId) as Poll | undefined;
  if (!poll) return null;
  const candidates = db.prepare("SELECT * FROM candidates WHERE poll_id = ?").all(poll.id) as Candidate[];
  return { ...poll, candidates };
}

export function getActivePoll(): (Poll & { candidates: Candidate[] }) | null {
  const poll = db.prepare("SELECT * FROM polls WHERE status = 'active' LIMIT 1").get() as Poll | undefined;
  if (!poll) return null;
  const candidates = db.prepare("SELECT * FROM candidates WHERE poll_id = ?").all(poll.id) as Candidate[];
  return { ...poll, candidates };
}

export function startPoll(pollId: string): void {
  db.prepare("UPDATE polls SET status = 'active' WHERE id = ? AND status = 'draft'").run(pollId);
}

export function getActivePolls(): (Poll & { candidates: Candidate[]; vote_count: number })[] {
  const polls = db.prepare("SELECT * FROM polls WHERE status = 'active' ORDER BY created_at DESC").all() as Poll[];
  const candidateStmt = db.prepare("SELECT * FROM candidates WHERE poll_id = ?");
  const countStmt = db.prepare("SELECT COUNT(*) as c FROM votes WHERE poll_id = ?");

  return polls.map((poll) => ({
    ...poll,
    candidates: candidateStmt.all(poll.id) as Candidate[],
    vote_count: (countStmt.get(poll.id) as { c: number }).c,
  }));
}

export function endPoll(pollId: string): void {
  db.prepare("UPDATE polls SET status = 'ended', ended_at = datetime('now') WHERE id = ?").run(pollId);
}

export function deletePoll(pollId: string): void {
  db.prepare("DELETE FROM polls WHERE id = ?").run(pollId);
}

// --- Voting ---

export function castVote(pollId: string, candidateId: string, provinceCode: string, deviceToken: string, ipHash: string): VoteRecord {
  const id = generateId();
  const normalizedCode = provinceCode.toLowerCase();
  db.prepare(
    "INSERT INTO votes (id, poll_id, candidate_id, province_code, device_token, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
  ).run(id, pollId, candidateId, normalizedCode, deviceToken, ipHash);
  return db.prepare("SELECT * FROM votes WHERE id = ?").get(id) as VoteRecord;
}

// --- Results (optimized with composite indexes) ---

export function getCandidateResults(pollId: string): CandidateResult[] {
  const candidates = db.prepare("SELECT * FROM candidates WHERE poll_id = ?").all(pollId) as Candidate[];
  const counts = db.prepare(
    "SELECT candidate_id, COUNT(*) as c FROM votes WHERE poll_id = ? GROUP BY candidate_id"
  ).all(pollId) as { candidate_id: string; c: number }[];

  const countMap = new Map(counts.map((r) => [r.candidate_id, r.c]));

  return candidates.map((c) => ({
    candidate_id: c.id,
    name: c.name,
    color: c.color,
    color2: c.color2 || null,
    photo_url: c.photo_url,
    votes: countMap.get(c.id) || 0,
  }));
}

export function getProvinceResults(pollId: string): ProvinceResult[] {
  const rows = db.prepare(`
    SELECT province_code, candidate_id, COUNT(*) as c
    FROM votes WHERE poll_id = ?
    GROUP BY province_code, candidate_id
  `).all(pollId) as { province_code: string; candidate_id: string; c: number }[];

  const candidates = db.prepare("SELECT id, color FROM candidates WHERE poll_id = ?").all(pollId) as { id: string; color: string }[];
  const colorMap = new Map(candidates.map((c) => [c.id, c.color]));

  const grouped = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!grouped.has(row.province_code)) grouped.set(row.province_code, new Map());
    grouped.get(row.province_code)!.set(row.candidate_id, row.c);
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

export function getRecentVotes(pollId: string, limit: number = 25): (VoteRecord & { candidate_name: string; candidate_color: string })[] {
  return db.prepare(`
    SELECT v.*, c.name as candidate_name, c.color as candidate_color
    FROM votes v JOIN candidates c ON v.candidate_id = c.id
    WHERE v.poll_id = ?
    ORDER BY v.created_at DESC LIMIT ?
  `).all(pollId, limit) as (VoteRecord & { candidate_name: string; candidate_color: string })[];
}

export function getTotalVotes(pollId: string): number {
  return (db.prepare("SELECT COUNT(*) as c FROM votes WHERE poll_id = ?").get(pollId) as { c: number }).c;
}

export function getIrregularities(pollId: string): { ip_hash: string; count: number; provinces: string }[] {
  return db.prepare(`
    SELECT ip_hash, COUNT(*) as count, GROUP_CONCAT(DISTINCT province_code) as provinces
    FROM votes WHERE poll_id = ?
    GROUP BY ip_hash HAVING COUNT(*) > 1
    ORDER BY count DESC LIMIT 50
  `).all(pollId) as { ip_hash: string; count: number; provinces: string }[];
}
