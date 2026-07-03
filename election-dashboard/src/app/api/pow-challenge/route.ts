import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const challenge = crypto.randomBytes(16).toString("hex");
  const difficulty = 4;

  return NextResponse.json({ challenge, difficulty });
}
