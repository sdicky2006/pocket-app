import { NextResponse } from "next/server";
import { wsBridge } from "@/lib/wsBridge";

export async function GET() {
  const status = await wsBridge.getStatus();
  return NextResponse.json({ frames: status.recentFrames ?? [] });
}
