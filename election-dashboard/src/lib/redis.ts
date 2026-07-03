import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisPub: Redis | undefined;
  redisSub: Redis | undefined;
};

const skipRedis = process.env.SKIP_REDIS === "true" || !process.env.REDIS_URL;

export const redis = skipRedis
  ? null
  : globalForRedis.redis ?? new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });

export const redisPub = skipRedis
  ? null
  : globalForRedis.redisPub ?? new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });

export const redisSub = skipRedis
  ? null
  : globalForRedis.redisSub ?? new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });

if (process.env.NODE_ENV !== "production") {
  if (!skipRedis) {
    globalForRedis.redis = redis!;
    globalForRedis.redisPub = redisPub!;
    globalForRedis.redisSub = redisSub!;
  }
}
