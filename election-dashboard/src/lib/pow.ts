import crypto from "crypto";
import { redis } from "./redis";

interface SolvedChallenge {
  usedAt: number;
}

interface IssuedChallenge {
  createdAt: number;
}

const solvedChallenges = new Map<string, SolvedChallenge>();
const issuedChallenges = new Map<string, IssuedChallenge>();
const CHALLENGE_TTL = 5 * 60 * 1000;
const CHALLENGE_TTL_SECONDS = 5 * 60;

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of solvedChallenges) {
      if (now - val.usedAt > CHALLENGE_TTL) solvedChallenges.delete(key);
    }
    for (const [key, val] of issuedChallenges) {
      if (now - val.createdAt > CHALLENGE_TTL) issuedChallenges.delete(key);
    }
  }, 60_000);
}

export function verifyPoW(challenge: string, nonce: number, difficulty: number): boolean {
  const input = challenge + nonce.toString();
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const requiredPrefix = "0".repeat(difficulty);
  return hash.startsWith(requiredPrefix);
}

export async function issueChallenge(challenge: string): Promise<void> {
  if (!redis) {
    issuedChallenges.set(challenge, { createdAt: Date.now() });
    return;
  }
  try {
    await redis.set(`pow:issued:${challenge}`, "1", "EX", CHALLENGE_TTL_SECONDS);
  } catch (error) {
    console.error("Redis issue challenge error, falling back to memory:", error);
    issuedChallenges.set(challenge, { createdAt: Date.now() });
  }
}

export async function isChallengeIssued(challenge: string): Promise<boolean> {
  if (!redis) {
    const issued = issuedChallenges.get(challenge);
    if (!issued) return false;
    if (Date.now() - issued.createdAt > CHALLENGE_TTL) {
      issuedChallenges.delete(challenge);
      return false;
    }
    return true;
  }
  try {
    const exists = await redis.exists(`pow:issued:${challenge}`);
    return exists === 1;
  } catch (error) {
    console.error("Redis check challenge error, falling back to memory:", error);
    const issued = issuedChallenges.get(challenge);
    if (!issued) return false;
    if (Date.now() - issued.createdAt > CHALLENGE_TTL) {
      issuedChallenges.delete(challenge);
      return false;
    }
    return true;
  }
}

export async function markChallengeUsed(challenge: string): Promise<boolean> {
  if (!redis) {
    issuedChallenges.delete(challenge);
    if (solvedChallenges.has(challenge)) {
      return false;
    }
    solvedChallenges.set(challenge, { usedAt: Date.now() });
    return true;
  }
  try {
    const deleted = await redis.del(`pow:issued:${challenge}`);
    if (deleted === 0) {
      return false;
    }
    const key = `pow:solved:${challenge}`;
    const wasSet = await redis.set(key, "1", "EX", CHALLENGE_TTL_SECONDS, "NX");
    return wasSet === "OK";
  } catch (error) {
    console.error("Redis mark challenge used error, falling back to memory:", error);
    issuedChallenges.delete(challenge);
    if (solvedChallenges.has(challenge)) {
      return false;
    }
    solvedChallenges.set(challenge, { usedAt: Date.now() });
    return true;
  }
}
