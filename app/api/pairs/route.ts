import { NextRequest, NextResponse } from "next/server";
import { randomHumanDelay, allowRequest } from "@/lib/stealth";
import { wsBridge } from "@/lib/wsBridge";
import { cacheGet, cacheSet } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!allowRequest(`pairs:${ip}`, 20, 10)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const cached = await cacheGet<any>('pairs:list');
    if (cached) {
      return NextResponse.json({ pairs: cached, cached: true });
    }

    await randomHumanDelay(120, 420);
    
    // Prefer live instruments discovered from websocket (no DOM scraping) [[websocket only]]
    const instruments = wsBridge.getInstruments();
    let pairs = instruments.map(inst => ({
      id: inst.id,
      symbol: inst.symbol,
      name: inst.symbol,
      category: inst.assetType === 'Cryptocurrencies' ? 'crypto' : inst.assetType === 'Currency' ? 'major' : inst.assetType === 'Commodities' ? 'exotic' : inst.assetType === 'Indices' ? 'minor' : 'minor',
      price: Number.isFinite(inst.price) ? inst.price : 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      isActive: true,
      lastUpdate: inst.lastUpdate,
      payout: undefined as number | undefined,
    }));

    // If very few instruments are present, synthesize a baseline set from discovered symbols
    if (pairs.length < 10) {
      const discovered = wsBridge.getDiscoveredSymbols();
      const seen = new Set(pairs.map(p => p.id));
      for (const sym of discovered) {
        const id = sym.replace('/', '');
        if (seen.has(id)) continue;
        pairs.push({
          id,
          symbol: sym,
          name: sym,
          category: sym.includes('BTC') || sym.includes('ETH') ? 'crypto' : sym.endsWith('/USD') ? 'major' : 'minor',
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          isActive: true,
          lastUpdate: Date.now(),
        });
        if (pairs.length >= 50) break; // larger cap
      }
    }

    // Only show actively priced instruments to avoid 0.0000 noise
    const now = Date.now();
    pairs = pairs
      .filter(p => Number.isFinite(p.price) && p.price > 0 && now - p.lastUpdate < 60_000)
      .sort((a, b) => b.lastUpdate - a.lastUpdate || a.symbol.localeCompare(b.symbol));

    // If none found, return empty list (client can handle "0 pairs" UI)
    await cacheSet('pairs:list', pairs, pairs.length > 0 ? 30 : 5); // short TTL; shorter when empty to retry soon

    return NextResponse.json({ pairs, cached: false, source: 'pocket-option-bridge' });
  } catch (e) {
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
