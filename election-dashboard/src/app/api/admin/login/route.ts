import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { hashIP } from "@/lib/election";
import { logAudit } from "@/lib/audit";
import { signSession, COOKIE_NAME } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const clientIp = ip.split(",")[0].trim();
    const ipHash = hashIP(clientIp);

    // Rate limit: 5 attempts per 15 minutes
    const lockoutKey = `admin_login_lockout:${ipHash}`;
    const rateResult = await checkRateLimit(lockoutKey, 5, 15 * 60 * 1000);

    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin." },
        { status: 429 }
      );
    }

    const { password } = await request.json();
    const ADMIN_PIN = process.env.ADMIN_PIN;

    if (process.env.NODE_ENV === "production" && !ADMIN_PIN) {
      throw new Error("CRITICAL CONFIGURATION ERROR: ADMIN_PIN environment variable is not defined in production!");
    }

    const expectedPassword = ADMIN_PIN || "admin2026";

    if (password !== expectedPassword) {
      logAudit("admin_login_failed", "anonymous", { ip: clientIp });
      return NextResponse.json(
        { error: "Hatalı şifre.", remainingAttempts: rateResult.remaining },
        { status: 401 }
      );
    }

    // Set signed HttpOnly secure session cookie
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
    const sessionToken = signSession(expiresAt);

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });

    logAudit("admin_login_success", "admin", { ip: clientIp });
    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
