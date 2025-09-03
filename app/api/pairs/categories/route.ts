import { NextResponse } from 'next/server';
import { wsBridge } from '@/lib/wsBridge';

export async function GET() {
  try {
    const instruments = wsBridge.getInstruments();
    const buckets: Record<string, Array<{ id: string; symbol: string; price: number; lastUpdate: number }>> = {
      Favorites: [],
      Currency: [],
      Cryptocurrencies: [],
      Commodities: [],
      Stocks: [],
      Indices: [],
    };
    for (const inst of instruments) {
      (buckets[inst.assetType] ||= []).push({ id: inst.id, symbol: inst.symbol, price: inst.price, lastUpdate: inst.lastUpdate });
    }
    // augment with discovered symbols without prices to surface more entries
    const discovered = wsBridge.getDiscoveredSymbols();
    const seen = new Set(instruments.map(i => i.id));
    for (const sym of discovered) {
      const id = sym.replace('/', '');
      if (seen.has(id)) continue;
      const assetType = /BTC|ETH/.test(sym) ? 'Cryptocurrencies' : sym.endsWith('/USD') ? 'Currency' : 'Stocks';
      (buckets[assetType] ||= []).push({ id, symbol: sym, price: 0, lastUpdate: Date.now() });
      seen.add(id);
    }
    // sort each bucket by symbol
    for (const k of Object.keys(buckets)) {
      buckets[k] = (buckets[k] || []).sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    return NextResponse.json({ ok: true, categories: buckets });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}


