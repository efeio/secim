import { PrismaClient } from "@prisma/client";

interface SqlitePoll {
  id: string;
  title: string;
  country: string;
  status: string;
  created_at: string;
  ended_at: string | null;
}

interface SqliteCandidate {
  id: string;
  poll_id: string;
  name: string;
  color: string;
  color2: string | null;
  photo_url: string | null;
}

interface SqliteVote {
  id: string;
  poll_id: string;
  candidate_id: string;
  province_code: string;
  device_token: string;
  ip_hash: string;
  created_at: string;
}

interface SqliteAuditLog {
  id: number;
  action: string;
  actor: string | null;
  payload: string | null;
  created_at: string;
}

async function main() {
  console.log("Migration script started. Note: Make sure better-sqlite3 is installed temporarily to run this.");

  let Database;
  try {
    // @ts-expect-error: better-sqlite3 is not installed by default in prisma build environment
    const mod = await import("better-sqlite3");
    Database = mod.default;
  } catch {
    console.error("Error: 'better-sqlite3' package is not installed. Please run: npm install better-sqlite3");
    process.exit(1);
  }

  const sqliteDb = new Database("./election.db");
  const prisma = new PrismaClient();

  try {
    // 1. Migrate polls
    const polls = sqliteDb.prepare("SELECT * FROM polls").all() as SqlitePoll[];
    console.log(`Found ${polls.length} polls in SQLite.`);
    for (const poll of polls) {
      const exists = await prisma.poll.findUnique({ where: { id: poll.id } });
      if (!exists) {
        await prisma.poll.create({
          data: {
            id: poll.id,
            title: poll.title,
            country: poll.country,
            status: poll.status === "active" ? "active" : poll.status === "ended" ? "ended" : "draft",
            createdAt: new Date(poll.created_at),
            endedAt: poll.ended_at ? new Date(poll.ended_at) : null,
          },
        });
      }
    }
    console.log("Polls migrated.");

    // 2. Migrate candidates
    const candidates = sqliteDb.prepare("SELECT * FROM candidates").all() as SqliteCandidate[];
    console.log(`Found ${candidates.length} candidates in SQLite.`);
    for (const cand of candidates) {
      const exists = await prisma.candidate.findUnique({ where: { id: cand.id } });
      if (!exists) {
        await prisma.candidate.create({
          data: {
            id: cand.id,
            pollId: cand.poll_id,
            name: cand.name,
            color: cand.color,
            color2: cand.color2,
            photoUrl: cand.photo_url,
          },
        });
      }
    }
    console.log("Candidates migrated.");

    // 3. Migrate votes
    const votes = sqliteDb.prepare("SELECT * FROM votes").all() as SqliteVote[];
    console.log(`Found ${votes.length} votes in SQLite.`);

    // Batch insert votes for performance
    const batchSize = 1000;
    for (let i = 0; i < votes.length; i += batchSize) {
      const batch = votes.slice(i, i + batchSize);

      // Filter out existing ones
      const batchIds = batch.map((v) => v.id);
      const existing = await prisma.vote.findMany({
        where: { id: { in: batchIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const toInsert = batch.filter((v) => !existingIds.has(v.id)).map((v) => ({
        id: v.id,
        pollId: v.poll_id,
        candidateId: v.candidate_id,
        provinceCode: v.province_code,
        deviceToken: v.device_token,
        ipHash: v.ip_hash,
        createdAt: new Date(v.created_at),
      }));

      if (toInsert.length > 0) {
        await prisma.vote.createMany({
          data: toInsert,
          skipDuplicates: true,
        });
      }

      console.log(`Migrated votes ${i} to ${Math.min(i + batchSize, votes.length)}...`);
    }
    console.log("Votes migrated.");

    // 4. Migrate audit logs
    const logs = sqliteDb.prepare("SELECT * FROM audit_logs").all() as SqliteAuditLog[];
    console.log(`Found ${logs.length} audit logs in SQLite.`);
    for (const log of logs) {
      await prisma.auditLog.create({
        data: {
          action: log.action,
          actor: log.actor,
          payload: log.payload ? JSON.parse(log.payload) : undefined,
          createdAt: new Date(log.created_at),
        },
      });
    }
    console.log("Audit logs migrated.");
    console.log("Migration successfully completed!");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    sqliteDb.close();
    await prisma.$disconnect();
  }
}

main();
