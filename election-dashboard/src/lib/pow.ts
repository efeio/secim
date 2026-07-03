import crypto from "crypto";

interface SolvedChallenge {
  usedAt: number;
}

const solvedChallenges = new Map<string, SolvedChallenge>();
const CHALLENGE_TTL = 5 * 60 * 1000;

export function verifyPoW(challenge: string, nonce: number, difficulty: number): boolean {
  const input = challenge + nonce.toString();
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const requiredPrefix = "0".repeat(difficulty);
  return hash.startsWith(requiredPrefix);
}

export function markChallengeUsed(challenge: string): boolean {
  if (solvedChallenges.has(challenge)) {
    return false;
  }
  solvedChallenges.set(challenge, { usedAt: Date.now() });
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of solvedChallenges) {
    if (now - val.usedAt > CHALLENGE_TTL) solvedChallenges.delete(key);
  }
}, 60_000);
