import crypto from "crypto";
import { NextRequest } from "next/server";

const ADMIN_PIN = process.env.ADMIN_PIN;

if (process.env.NODE_ENV === "production" && !ADMIN_PIN) {
  throw new Error("CRITICAL CONFIGURATION ERROR: ADMIN_PIN environment variable is not defined in production!");
}

const SESSION_SECRET = ADMIN_PIN || "dev-fallback-secret-2026";
export const COOKIE_NAME = "admin_session";

export function signSession(expiresAt: number): string {
  const data = expiresAt.toString();
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  return `${data}.${signature}`;
}

export function verifySession(cookieValue: string): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [data, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  if (signature !== expectedSignature) return false;

  const expiresAt = parseInt(data, 10);
  return expiresAt > Date.now();
}

export function checkAdminAuth(request: NextRequest): boolean {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  return verifySession(cookie.value);
}
