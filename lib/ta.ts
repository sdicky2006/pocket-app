export type Candle = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
};

export function ema(values: number[], period: number): number[] {
  if (period <= 1) return values.slice();
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values[0];
  result.push(prev);
  for (let i = 1; i < values.length; i++) {
    const value = values[i] * k + prev * (1 - k);
    result.push(value);
    prev = value;
  }
  return result;
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length < period + 1) return Array(values.length).fill(50);
  const rsis: number[] = Array(values.length).fill(50);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  gain /= period; loss /= period;
  rsis[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const curGain = diff > 0 ? diff : 0;
    const curLoss = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + curGain) / period;
    loss = (loss * (period - 1) + curLoss) / period;
    rsis[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return rsis;
}

export function minMax(values: number[], lookback: number): { min: number; max: number }[] {
  const out: { min: number; max: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - lookback + 1);
    let mn = Infinity, mx = -Infinity;
    for (let j = start; j <= i; j++) {
      if (values[j] < mn) mn = values[j];
      if (values[j] > mx) mx = values[j];
    }
    out.push({ min: mn, max: mx });
  }
  return out;
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticOHLC(
  seedKey: string,
  length = 240,
  startPrice = 1.1,
  volatility = 0.002
): Candle[] {
  const seedFn = xmur3(seedKey);
  const rand = mulberry32(Math.floor(seedFn() * 1e9));
  const candles: Candle[] = [];
  let price = startPrice * (0.9 + rand() * 0.2);
  const now = Date.now();
  for (let i = length - 1; i >= 0; i--) {
    const t = now - i * 60_000; // 1m bars
    const drift = (rand() - 0.5) * volatility * 0.2;
    const shock = (rand() - 0.5) * volatility;
    price = Math.max(0.0001, price * (1 + drift + shock));
    const spread = Math.max(0.00005, volatility * (0.5 + rand()));
    const open = price * (1 + (rand() - 0.5) * spread * 0.2);
    const close = price * (1 + (rand() - 0.5) * spread * 0.2);
    const high = Math.max(open, close) * (1 + rand() * spread);
    const low = Math.min(open, close) * (1 - rand() * spread);
    candles.push({ time: t, open, high, low, close });
  }
  return candles;
}

export function toCloses(c: Candle[]): number[] {
  return c.map((x) => x.close);
}

// --- Swings & Fibonacci ---
export function findRecentSwing(candles: Candle[], window: number): { swingHigh: number; swingLow: number } {
  const slice = candles.slice(-window);
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  for (const c of slice) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }
  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow)) {
    return { swingHigh: candles[candles.length - 1].high, swingLow: candles[candles.length - 1].low };
  }
  return { swingHigh, swingLow };
}

export function fibonacciLevels(swingHigh: number, swingLow: number) {
  const diff = swingHigh - swingLow;
  const level = (pct: number) => swingHigh - diff * pct;
  return {
    level23_6: level(0.236),
    level38_2: level(0.382),
    level50_0: level(0.5),
    level61_8: level(0.618),
    level78_6: level(0.786),
  };
}

export type CandlePattern = 'bullishEngulfing' | 'bearishEngulfing' | 'hammer' | 'shootingStar' | 'doji' | 'pinBarBull' | 'pinBarBear';

export function detectPatterns(candles: Candle[]): CandlePattern[] {
  const patterns: CandlePattern[] = [];
  if (candles.length < 2) return patterns;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const bodyLast = Math.abs(last.close - last.open);
  const bodyPrev = Math.abs(prev.close - prev.open);
  const rangeLast = last.high - last.low;

  // Engulfing
  if (bodyLast > bodyPrev * 1.1) {
    const bullish = last.close > last.open && prev.close < prev.open && last.close >= prev.open && last.open <= prev.close;
    const bearish = last.close < last.open && prev.close > prev.open && last.open >= prev.close && last.close <= prev.open;
    if (bullish) patterns.push('bullishEngulfing');
    if (bearish) patterns.push('bearishEngulfing');
  }

  // Doji (small body, larger range)
  if (rangeLast > 0 && bodyLast / rangeLast < 0.1) patterns.push('doji');

  // Hammer / Shooting Star
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  if (lowerWick > bodyLast * 2 && upperWick < bodyLast) patterns.push('hammer');
  if (upperWick > bodyLast * 2 && lowerWick < bodyLast) patterns.push('shootingStar');

  // Pin bars
  if (lowerWick > rangeLast * 0.6) patterns.push('pinBarBull');
  if (upperWick > rangeLast * 0.6) patterns.push('pinBarBear');

  return patterns;
}

// --- Tick utilities for non-lagging features ---
export type Tick = { ts: number; price: number; dir: -1 | 0 | 1 };

export function ticksToMinuteCandles(ticks: Tick[], minutes = 1): Candle[] {
  if (!ticks.length) return [];
  const ms = minutes * 60_000;
  const start = ticks[0].ts - (ticks[0].ts % ms);
  const buckets: Map<number, Candle> = new Map();
  for (const t of ticks) {
    const key = start + Math.floor((t.ts - start) / ms) * ms;
    const c = buckets.get(key);
    if (!c) {
      buckets.set(key, { time: key, open: t.price, high: t.price, low: t.price, close: t.price });
    } else {
      c.high = Math.max(c.high, t.price);
      c.low = Math.min(c.low, t.price);
      c.close = t.price;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

export function realizedVolatility(ticks: Tick[], lookbackMs: number): number {
  if (ticks.length < 2) return 0;
  const cutoff = ticks[ticks.length - 1].ts - lookbackMs;
  const sel = ticks.filter(t => t.ts >= cutoff);
  if (sel.length < 2) return 0;
  const rets: number[] = [];
  for (let i = 1; i < sel.length; i++) {
    const r = Math.log(sel[i].price / sel[i - 1].price);
    if (Number.isFinite(r)) rets.push(r);
  }
  if (!rets.length) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const var_ = rets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / rets.length;
  return Math.sqrt(var_);
}

export function orderFlowImbalance(ticks: Tick[], lookbackMs: number): { imbalance: number; pressure: number } {
  if (!ticks.length) return { imbalance: 0, pressure: 0 };
  const cutoff = ticks[ticks.length - 1].ts - lookbackMs;
  let up = 0, down = 0, flat = 0;
  for (let i = ticks.length - 1; i >= 0; i--) {
    const t = ticks[i];
    if (t.ts < cutoff) break;
    if (t.dir > 0) up++; else if (t.dir < 0) down++; else flat++;
  }
  const total = up + down + flat || 1;
  const imbalance = (up - down) / total; // -1..1
  const pressure = (up + down) / total; // activity ratio 0..1
  return { imbalance, pressure };
}

export function detectLiquiditySweep(candles: Candle[], window = 20): { type: 'high' | 'low' | null; strength: number } {
  if (candles.length < 3) return { type: null, strength: 0 };
  const slice = candles.slice(-window);
  const last = slice[slice.length - 1];
  const prev = slice[slice.length - 2];
  const high = Math.max(...slice.map(c => c.high));
  const low = Math.min(...slice.map(c => c.low));
  const sweptHigh = last.high > high * 0.999 && last.close < prev.close && (last.high - last.close) > (last.close - last.low);
  const sweptLow = last.low < low * 1.001 && last.close > prev.close && (last.close - last.low) > (last.high - last.close);
  if (sweptHigh) return { type: 'high', strength: (last.high - last.close) / Math.max(1e-9, last.high - last.low) };
  if (sweptLow) return { type: 'low', strength: (last.close - last.low) / Math.max(1e-9, last.high - last.low) };
  return { type: null, strength: 0 };
}

export function detectFVG(candles: Candle[]): { hasBull: boolean; hasBear: boolean } {
  if (candles.length < 3) return { hasBull: false, hasBear: false };
  const a = candles[candles.length - 3];
  const b = candles[candles.length - 2];
  const c = candles[candles.length - 1];
  const hasBull = a.high < c.low && b.close > a.high && c.close > b.high;
  const hasBear = a.low > c.high && b.close < a.low && c.close < b.low;
  return { hasBull, hasBear };
}

export function valueAreaFromTicks(ticks: Tick[], bins = 30): { pocPrice: number; valueLow: number; valueHigh: number } {
  if (ticks.length < 10) return { pocPrice: ticks[ticks.length - 1]?.price || 0, valueLow: 0, valueHigh: 0 };
  const min = Math.min(...ticks.map(t => t.price));
  const max = Math.max(...ticks.map(t => t.price));
  if (min === max) return { pocPrice: min, valueLow: min, valueHigh: max };
  const counts = new Array(bins).fill(0);
  const step = (max - min) / bins;
  for (const t of ticks) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((t.price - min) / step)));
    counts[idx]++;
  }
  let pocIdx = 0, pocVal = -1;
  for (let i = 0; i < bins; i++) if (counts[i] > pocVal) { pocVal = counts[i]; pocIdx = i; }
  // Build VA (approx 70%) around POC
  const total = counts.reduce((a, b) => a + b, 0);
  let acc = counts[pocIdx];
  let lo = pocIdx, hi = pocIdx;
  while (acc / total < 0.7 && (lo > 0 || hi < bins - 1)) {
    const left = lo > 0 ? counts[lo - 1] : -1;
    const right = hi < bins - 1 ? counts[hi + 1] : -1;
    if (right >= left) { hi++; acc += counts[hi]; } else { lo--; acc += counts[lo]; }
  }
  return { pocPrice: min + (pocIdx + 0.5) * step, valueLow: min + lo * step, valueHigh: min + (hi + 1) * step };
}