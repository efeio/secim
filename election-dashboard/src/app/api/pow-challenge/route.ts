import { NextResponse } from "next/server";
import crypto from "crypto";
import { issueChallenge } from "@/lib/pow";

export const dynamic = "force-dynamic";

export async function GET() {
  const challenge = crypto.randomBytes(16).toString("hex");
  const difficulty = 5;

  await issueChallenge(challenge);

  return NextResponse.json({ challenge, difficulty });
}
