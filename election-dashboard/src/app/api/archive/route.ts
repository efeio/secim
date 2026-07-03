import { NextResponse } from "next/server";
import { getEndedPolls } from "@/lib/election";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const polls = getEndedPolls();
    return NextResponse.json({ polls });
  } catch (error) {
    console.error("Archive fetch error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
