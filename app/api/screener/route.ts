import { NextRequest, NextResponse } from "next/server";
import { wsBridge } from "@/lib/wsBridge";
import { analyzePocketOptionSignal, type PocketExpiry } from "@/lib/signalEngine";
import { allowRequest, randomHumanDelay } from "@/lib/stealth";

export const runtime = 'nodejs';

type ScreenerItem = {
  symbol: string;
  category: string;
  price: number;
  lastUpdate: number;
  best: { expiry: PocketExpiry; side: 'CALL'|'PUT'|'NEUTRAL'; confidence: number; timeframeUsed: string };
};

const EXPIRIES: PocketExpiry[] = ['30s','1m','3m','5m','15m'];

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!allowRequest(`screener:${ip}`, 4, 2)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    // Small jitter to avoid thundering herd
    await randomHumanDelay(80, 240);

    const instruments = wsBridge.getInstruments();
    const now = Date.now();
    // Only consider recently priced instruments
    const candidates = instruments
      .filter(x => Number.isFinite(x.price) && x.price > 0 && now - x.lastUpdate < 60_000)
      .slice(0, 80);

    // Analyze with limited concurrency
    const concurrency = 6;
    let idx = 0;
    const results: ScreenerItem[] = [];
    const runOne = async () => {
      while (idx < candidates.length) {
        const i = idx++;
        const inst = candidates[i];
        try {
          let best: ScreenerItem['best'] | null = null;
          for (const ex of EXPIRIES) {
            const res = await analyzePocketOptionSignal({ pair: inst.symbol as any, expiry: ex });
            const cur = { expiry: ex, side: res.side, confidence: res.confidence, timeframeUsed: res.timeframeUsed } as ScreenerItem['best'];
            if (!best || cur.confidence > best.confidence) best = cur;
          }
          if (best) {
            results.push({ symbol: inst.symbol, category: inst.assetType.toLowerCase(), price: inst.price, lastUpdate: inst.lastUpdate, best });
          }
        } catch {}
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => runOne()));

    results.sort((a, b) => b.best.confidence - a.best.confidence || a.symbol.localeCompare(b.symbol));

    return NextResponse.json({ generatedAt: Date.now(), count: results.length, items: results.slice(0, 100) });
  } catch (e: any) {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}


