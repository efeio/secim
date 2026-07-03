console.log("1. Testing prisma import...");
import prisma from "../src/lib/prisma";
console.log("Prisma client imported successfully.");

console.log("2. Testing redis import...");
import { redis, redisPub, redisSub } from "../src/lib/redis";
console.log("Redis client properties:", { redis: !!redis, redisPub: !!redisPub, redisSub: !!redisSub });

console.log("3. Testing eventBus import...");
import { eventBus } from "../src/lib/events";
console.log("EventBus imported successfully.");

console.log("4. Testing election library import...");
import * as election from "../src/lib/election";
console.log("Election library imported successfully.");

console.log("5. Testing rateLimit library import...");
import * as rateLimit from "../src/lib/ratelimit";
console.log("RateLimit library imported successfully.");

console.log("All imports verified successfully!");
process.exit(0);
