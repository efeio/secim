interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;

export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 3
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now >= entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { success: true, remaining: maxRequests - 1, reset: now + WINDOW_MS };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, reset: entry.resetAt };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 60_000);
