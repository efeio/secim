import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyPoW, issueChallenge, isChallengeIssued, markChallengeUsed } from "../lib/pow";
import { checkRateLimit } from "../lib/ratelimit";
import { signSession, verifySession } from "../lib/adminAuth";

describe("3. Admin Session (HMAC) & Security Tests", () => {
  it("should sign and verify valid session cookies", () => {
    const expiresAt = Date.now() + 1000 * 60 * 60;
    const cookie = signSession(expiresAt);

    const verified = verifySession(cookie);
    expect(verified).toBe(true);
  });

  it("should reject expired session cookies", () => {
    const expiredAt = Date.now() - 1000 * 60;
    const cookie = signSession(expiredAt);

    const verified = verifySession(cookie);
    expect(verified).toBe(false);
  });

  it("should reject tampered signature cookies", () => {
    const expiresAt = Date.now() + 1000 * 60 * 60;
    const cookie = signSession(expiresAt);

    const tampered = cookie.slice(0, -5) + "abcde";

    const verified = verifySession(tampered);
    expect(verified).toBe(false);
  });
});

describe("1. Proof of Work (PoW) Tests", () => {
  it("should generate and verify correct PoW nonce solution", async () => {
    const challenge = "test-challenge-pow-token";
    await issueChallenge(challenge);

    expect(await isChallengeIssued(challenge)).toBe(true);

    let nonce = 0;
    while (!verifyPoW(challenge, nonce, 2)) {
      nonce++;
    }

    expect(verifyPoW(challenge, nonce, 2)).toBe(true);
    expect(verifyPoW(challenge, nonce + 1, 2)).toBe(false);
  });

  it("should enforce replay protection and single-use limit on challenges", async () => {
    const challenge = "one-time-pow-challenge";
    await issueChallenge(challenge);

    const used = await markChallengeUsed(challenge);
    expect(used).toBe(true);

    const reuse = await markChallengeUsed(challenge);
    expect(reuse).toBe(false);

    expect(await isChallengeIssued(challenge)).toBe(false);
  });
});

describe("2. Rate Limiting Tests (In-Memory Fallback)", () => {
  const ip = "rate-limit-test-ip";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should enforce sliding window max requests limit", async () => {
    let result = await checkRateLimit(ip, 3, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);

    result = await checkRateLimit(ip, 3, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);

    result = await checkRateLimit(ip, 3, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);

    result = await checkRateLimit(ip, 3, 60000);
    expect(result.success).toBe(false);
  });

  it("should reset rate limit after window time elapsed", async () => {
    let result = await checkRateLimit(ip + "-reset", 2, 10000);
    expect(result.success).toBe(true);

    result = await checkRateLimit(ip + "-reset", 2, 10000);
    expect(result.success).toBe(true);

    result = await checkRateLimit(ip + "-reset", 2, 10000);
    expect(result.success).toBe(false);

    vi.advanceTimersByTime(11000);

    result = await checkRateLimit(ip + "-reset", 2, 10000);
    expect(result.success).toBe(true);
  });
});

