import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const healthCheck: {
    status: string;
    timestamp: string;
    services: {
      database: { status: string; latencyMs?: number; error?: string };
      redis: { status: string; latencyMs?: number; error?: string };
    };
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      database: { status: "unknown" },
      redis: { status: "unknown" },
    },
  };

  let hasError = false;

  // 1. Check Database (Prisma + Postgres)
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = {
      status: "healthy",
      latencyMs: Date.now() - dbStart,
    };
  } catch (error: unknown) {
    hasError = true;
    healthCheck.services.database = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // 2. Check Redis
  const redisStart = Date.now();
  if (redis) {
    try {
      const pong = await redis.ping();
      if (pong === "PONG") {
        healthCheck.services.redis = {
          status: "healthy",
          latencyMs: Date.now() - redisStart,
        };
      } else {
        hasError = true;
        healthCheck.services.redis = {
          status: "unhealthy",
          error: `Unexpected ping response: ${pong}`,
        };
      }
    } catch (error: unknown) {
      hasError = true;
      healthCheck.services.redis = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    healthCheck.services.redis = {
      status: "skipped",
    };
  }

  if (hasError) {
    healthCheck.status = "unhealthy";
    return NextResponse.json(healthCheck, { status: 500 });
  }

  return NextResponse.json(healthCheck, { status: 200 });
}
