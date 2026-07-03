import { redis } from "./redis";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now >= entry.resetAt) memoryStore.delete(key);
    }
  }, 60_000);
}

export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 3,
  windowMs: number = 60_000
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now();

  if (!redis) {
    const entry = memoryStore.get(identifier);

    if (!entry || now >= entry.resetAt) {
      memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
      return { success: true, remaining: maxRequests - 1, reset: now + windowMs };
    }

    if (entry.count >= maxRequests) {
      return { success: false, remaining: 0, reset: entry.resetAt };
    }

    entry.count++;
    return { success: true, remaining: maxRequests - entry.count, reset: entry.resetAt };
  }

  const key = `rate_limit:${identifier}`;
  const clearBefore = now - windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, clearBefore);
    pipeline.zadd(key, now, member);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    pipeline.zrange(key, 0, 0, "WITHSCORES");

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Redis pipeline execution returned null");
    }

    const count = (results[2][1] as number) || 0;
    const oldestRange = results[4][1] as string[];
    const oldestTimestamp = oldestRange && oldestRange.length > 1 ? Number(oldestRange[1]) : now;
    const reset = oldestTimestamp + windowMs;

    if (count > maxRequests) {
      return { success: false, remaining: 0, reset };
    }

    return { success: true, remaining: maxRequests - count, reset };
  } catch (error) {
    console.error("Redis rate limit error, falling back to memory:", error);

    const entry = memoryStore.get(identifier);
    if (!entry || now >= entry.resetAt) {
      memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
      return { success: true, remaining: maxRequests - 1, reset: now + windowMs };
    }
    if (entry.count >= maxRequests) {
      return { success: false, remaining: 0, reset: entry.resetAt };
    }
    entry.count++;
    return { success: true, remaining: maxRequests - entry.count, reset: entry.resetAt };
  }
}
