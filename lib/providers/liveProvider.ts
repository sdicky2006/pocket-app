import type { MarketProvider } from "./marketProvider";

function parsePair(pair: string): { base: string; quote: string } {
  const [base, quote] = pair.replace(/\s+/g, '').split('/') as [string, string];
  return { base, quote };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

class FinnhubProvider implements MarketProvider {
  constructor(private apiKey: string) {}
  async getRecentCloses(pair: string, limit: number): Promise<number[]> {
    const { base, quote } = parsePair(pair);
    const symbol = `OANDA:${base}_${quote}`; // common mapping; adjust if needed
    const nowSec = Math.floor(Date.now() / 1000);
    // ~limit minutes back
    const from = nowSec - (limit + 5) * 60;
    const url = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${nowSec}&token=${this.apiKey}`;
    const data = await fetchJson(url);
    if (data.s !== 'ok' || !Array.isArray(data.c)) throw new Error('finnhub: bad response');
    const closes: number[] = data.c as number[];
    return closes.slice(-limit);
  }
}

class AlphaVantageProvider implements MarketProvider {
  constructor(private apiKey: string) {}
  async getRecentCloses(pair: string, limit: number): Promise<number[]> {
    const { base, quote } = parsePair(pair);
    const url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=${base}&to_symbol=${quote}&interval=1min&apikey=${this.apiKey}&outputsize=compact`;
    const data = await fetchJson(url);
    const series = data["Time Series FX (1min)"];
    if (!series || typeof series !== 'object') throw new Error('alphavantage: bad response');
    const sorted = Object.keys(series).sort(); // ascending by timestamp
    const closes: number[] = sorted.map((ts) => parseFloat(series[ts]["4. close"])).filter((n) => Number.isFinite(n));
    return closes.slice(-limit);
  }
}

export function getLiveProvider(): MarketProvider | null {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) return new FinnhubProvider(finnhubKey);
  const alphaKey = process.env.ALPHAVANTAGE_API_KEY;
  if (alphaKey) return new AlphaVantageProvider(alphaKey);
  return null;
}
