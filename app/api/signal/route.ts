import { NextRequest, NextResponse } from "next/server";
import { analyzePocketOptionSignal } from "@/lib/signalEngine";
import { allowRequest, randomHumanDelay, randomizeHeaders } from "@/lib/stealth";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!allowRequest(`signal:${ip}`, 8, 4)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    await randomHumanDelay(180, 650);

    const body = await req.json();
    const pair = String(body?.pair || "");
    const expiry = String(body?.expiry || "");

    if (!pair || !expiry) {
      return NextResponse.json({ error: "pair and expiry are required" }, { status: 400 });
    }

    // Optional: if calling external resources later, include randomized headers
    const _headers = randomizeHeaders();

    const result = await analyzePocketOptionSignal({ pair, expiry } as any);
    return NextResponse.json(result);
  } catch (e) {
    console.error("signal endpoint error", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
