import { Candle, ema, rsi, generateSyntheticOHLC, toCloses, findRecentSwing, fibonacciLevels, detectPatterns, Tick, ticksToMinuteCandles, realizedVolatility, orderFlowImbalance, detectLiquiditySweep, detectFVG, valueAreaFromTicks } from "./ta";
import { wsBridge } from "./wsBridge";
import { getLiveProvider } from "./providers/liveProvider";

export type PocketExpiry = "30s" | "1m" | "2m" | "3m" | "5m" | "10m" | "15m" | "30m" | "1h";
export type SignalSide = "CALL" | "PUT" | "NEUTRAL";

export interface AnalysisConfig {
  emaFastPeriod?: number; // default 9
  emaSlowPeriod?: number; // default 21
  rsiPeriod?: number; // default 14
  rsiOversold?: number; // default 35
  rsiOverbought?: number; // default 65
  weights?: {
    trend?: number; // default 12
    momentumStrong?: number; // default 10
    momentumMild?: number; // default 3
    sr?: number; // default 8
    fib?: number; // default 4
    pattern?: number; // default 6
    shortExpiryMeanRev?: number; // default 5
  };
}

function withDefaults(cfg?: AnalysisConfig) {
  const c = cfg ?? {};
  return {
    emaFastPeriod: c.emaFastPeriod ?? 9,
    emaSlowPeriod: c.emaSlowPeriod ?? 21,
    rsiPeriod: c.rsiPeriod ?? 14,
    rsiOversold: c.rsiOversold ?? 35,
    rsiOverbought: c.rsiOverbought ?? 65,
    weights: {
      trend: c.weights?.trend ?? 12,
      momentumStrong: c.weights?.momentumStrong ?? 10,
      momentumMild: c.weights?.momentumMild ?? 3,
      sr: c.weights?.sr ?? 8,
      fib: c.weights?.fib ?? 4,
      pattern: c.weights?.pattern ?? 6,
      shortExpiryMeanRev: c.weights?.shortExpiryMeanRev ?? 5,
    },
  };
}

export interface SignalRequest {
  pair: string;
  expiry: PocketExpiry;
  options?: AnalysisConfig;
}

export interface SignalResult {
  pair: string;
  expiry: PocketExpiry;
  side: SignalSide;
  confidence: number; // 0-100
  entryHint: string;
  rationale: string[];
  indicators: {
    emaFast: number;
    emaSlow: number;
    rsi: number;
    lastPrice: number;
    srWindowMin: number;
    srWindowMax: number;
  };
  timeframeUsed: string;
  components?: Array<{ key: string; score: number; notes: string }>;
  features?: {
    ofi?: { imbalance: number; pressure: number };
    vol?: { rv1m: number; rv5m: number };
    sweep?: { type: 'high' | 'low' | null; strength: number };
    fvg?: { hasBull: boolean; hasBear: boolean };
    profile?: { poc: number; vaLow: number; vaHigh: number };
    session?: { inWindow: boolean };
    dxyBias?: number;
  };
}

function mapExpiryToAnalysisTimeframe(expiry: PocketExpiry): { tf: string; lookback: number; srWindow: number } {
  switch (expiry) {
    case "30s":
      return { tf: "15s/1m synthetic", lookback: 240, srWindow: 40 };
    case "1m":
    case "2m":
      return { tf: "1m", lookback: 240, srWindow: 60 };
    case "3m":
    case "5m":
      return { tf: "1m/5m", lookback: 240, srWindow: 90 };
    case "10m":
    case "15m":
      return { tf: "5m/15m", lookback: 240, srWindow: 120 };
    case "30m":
    case "1h":
      return { tf: "15m/30m/1h", lookback: 240, srWindow: 180 };
    default:
      return { tf: "1m", lookback: 240, srWindow: 60 };
  }
}

export async function analyzePocketOptionSignal(req: SignalRequest): Promise<SignalResult> {
  const { pair, expiry, options } = req;
  const { tf, lookback, srWindow } = mapExpiryToAnalysisTimeframe(expiry);
  const cfg = withDefaults(options);

  // Pull recent ticks from live websocket bridge for non-lagging features
  const ticks: Tick[] = wsBridge.getRecentTicks(pair, 10 * 60_000);

  // Try live provider first (for close series scaffolding)
  let closes: number[] | null = null;
  try {
    const live = getLiveProvider();
    if (live) {
      closes = await live.getRecentCloses(pair, lookback);
    }
  } catch {}

  let candles: Candle[];
  if (closes && closes.length >= 10) {
    const approx: Candle[] = closes.map((c, i) => ({
      time: Date.now() - (closes!.length - 1 - i) * 60_000,
      open: c * (0.999 + Math.random() * 0.002),
      high: c * (1.0005 + Math.random() * 0.0015),
      low: c * (0.9995 - Math.random() * 0.0015),
      close: c,
    }));
    candles = approx;
  } else {
    candles = generateSyntheticOHLC(pair, lookback, inferStartPrice(pair));
  }
  closes = toCloses(candles);

  // If we have enough ticks, build minute candles to augment closes
  if (ticks.length >= 30) {
    const c1 = ticksToMinuteCandles(ticks, 1);
    if (c1.length >= 10) candles = c1;
    closes = toCloses(candles);
  }

  // Indicators with configurable periods
  const emaFastSeries = ema(closes, cfg.emaFastPeriod);
  const emaSlowSeries = ema(closes, cfg.emaSlowPeriod);
  const rsiSeries = rsi(closes, cfg.rsiPeriod);

  const last = closes.length - 1;
  const emaFast = emaFastSeries[last];
  const emaSlow = emaSlowSeries[last];
  const rsiLast = rsiSeries[last];
  const price = closes[last];

  // Support/Resistance window
  const wStart = Math.max(0, closes.length - srWindow);
  const window = closes.slice(wStart);
  const srMin = Math.min(...window);
  const srMax = Math.max(...window);
  const range = Math.max(1e-9, srMax - srMin);
  const pos = (price - srMin) / range;

  // Fibonacci using recent swing
  const swing = findRecentSwing(candles, Math.min(120, lookback));
  const fib = fibonacciLevels(swing.swingHigh, swing.swingLow);
  const near = (a: number, b: number, tolPct = 0.0015) => Math.abs(a - b) / Math.max(1e-9, b) < tolPct;

  // Candle patterns
  const patterns = detectPatterns(candles);

  // Scoring
  let score = 50;
  const rationale: string[] = [];
  const w = cfg.weights;
  const components: Array<{ key: string; score: number; notes: string }> = [];

  // Trend
  if (emaFast > emaSlow) { score += w.trend; rationale.push(`EMA(${cfg.emaFastPeriod}) > EMA(${cfg.emaSlowPeriod})`); components.push({ key: 'trend', score: w.trend, notes: 'bullish EMA alignment' }); }
  else if (emaFast < emaSlow) { score -= w.trend; rationale.push(`EMA(${cfg.emaFastPeriod}) < EMA(${cfg.emaSlowPeriod})`); components.push({ key: 'trend', score: -w.trend, notes: 'bearish EMA alignment' }); }

  // Momentum
  if (rsiLast < cfg.rsiOversold) { score += w.momentumStrong; rationale.push(`RSI(${cfg.rsiPeriod}) oversold (<${cfg.rsiOversold})`); components.push({ key: 'momentum', score: w.momentumStrong, notes: 'RSI oversold' }); }
  else if (rsiLast > cfg.rsiOverbought) { score -= w.momentumStrong; rationale.push(`RSI(${cfg.rsiPeriod}) overbought (>${cfg.rsiOverbought})`); components.push({ key: 'momentum', score: -w.momentumStrong, notes: 'RSI overbought' }); }
  else if (rsiLast > 50) { score += w.momentumMild; rationale.push('RSI > 50 bullish'); components.push({ key: 'momentum', score: w.momentumMild, notes: 'RSI > 50' }); }
  else { score -= w.momentumMild; rationale.push('RSI < 50 bearish'); components.push({ key: 'momentum', score: -w.momentumMild, notes: 'RSI < 50' }); }

  // S/R
  if (pos < 0.2) { score += w.sr; rationale.push('Near support'); components.push({ key: 'sr', score: w.sr, notes: 'near support' }); }
  else if (pos > 0.8) { score -= w.sr; rationale.push('Near resistance'); components.push({ key: 'sr', score: -w.sr, notes: 'near resistance' }); }

  // Fibonacci confluence
  if (near(price, fib.level61_8) || near(price, fib.level50_0) || near(price, fib.level38_2)) {
    if (emaFast >= emaSlow) { score += w.fib; rationale.push('Fib confluence (bullish)'); components.push({ key: 'fib', score: w.fib, notes: 'price near key Fib in bullish trend' }); }
    else { score -= w.fib; rationale.push('Fib confluence (bearish)'); components.push({ key: 'fib', score: -w.fib, notes: 'price near key Fib in bearish trend' }); }
  }

  // Patterns
  if (patterns.includes('bullishEngulfing') || patterns.includes('hammer') || patterns.includes('pinBarBull')) {
    score += w.pattern; rationale.push('Bullish candlestick pattern'); components.push({ key: 'pattern', score: w.pattern, notes: 'bullish PA' });
  }
  if (patterns.includes('bearishEngulfing') || patterns.includes('shootingStar') || patterns.includes('pinBarBear')) {
    score -= w.pattern; rationale.push('Bearish candlestick pattern'); components.push({ key: 'pattern', score: -w.pattern, notes: 'bearish PA' });
  }

  // Very short expiry mean-reversion
  if (expiry === '30s' || expiry === '1m') {
    if (rsiLast < Math.max(20, cfg.rsiOversold - 10)) { score += w.shortExpiryMeanRev; rationale.push('Short expiry mean reversion (oversold)'); components.push({ key: 'shortMR', score: w.shortExpiryMeanRev, notes: 'short-expiry MR (oversold)' }); }
    if (rsiLast > Math.min(80, cfg.rsiOverbought + 10)) { score -= w.shortExpiryMeanRev; rationale.push('Short expiry mean reversion (overbought)'); components.push({ key: 'shortMR', score: -w.shortExpiryMeanRev, notes: 'short-expiry MR (overbought)' }); }
  }

  // --- Institutional, non-lagging components ---
  // Order Flow Imbalance (last 30s and 2m)
  let ofi1 = { imbalance: 0, pressure: 0 }, ofi2 = { imbalance: 0, pressure: 0 };
  if (ticks.length) {
    ofi1 = orderFlowImbalance(ticks, 30_000);
    ofi2 = orderFlowImbalance(ticks, 120_000);
    const ofiScore = Math.round((ofi1.imbalance * 8) + (ofi2.imbalance * 6));
    if (ofiScore !== 0) { score += ofiScore; components.push({ key: 'orderFlow', score: ofiScore, notes: `imbalance=${ofi1.imbalance.toFixed(2)} pressure=${ofi1.pressure.toFixed(2)}` }); }
  }

  // Realized volatility regime (gate extremes)
  let rv1m = 0, rv5m = 0;
  if (ticks.length) {
    rv1m = realizedVolatility(ticks, 60_000);
    rv5m = realizedVolatility(ticks, 300_000);
    const ratio = rv1m / Math.max(1e-9, rv5m);
    // Penalize low activity and extreme bursts
    if (ratio < 0.6) { score -= 4; components.push({ key: 'volRegime', score: -4, notes: 'range compression' }); }
    if (ratio > 1.8) { score -= 4; components.push({ key: 'volRegime', score: -4, notes: 'volatility burst' }); }
  }

  // Liquidity sweep + rejection on 1m bars
  let sweep = { type: null as 'high' | 'low' | null, strength: 0 };
  if (candles.length >= 10) {
    sweep = detectLiquiditySweep(candles, 20);
    if (sweep.type === 'low') { score += Math.round(6 * sweep.strength); components.push({ key: 'sweep', score: Math.round(6 * sweep.strength), notes: 'low sweep + rejection' }); }
    if (sweep.type === 'high') { score -= Math.round(6 * sweep.strength); components.push({ key: 'sweep', score: -Math.round(6 * sweep.strength), notes: 'high sweep + rejection' }); }
  }

  // Fair Value Gap / Order Block proxy
  let fvg = { hasBull: false, hasBear: false };
  if (candles.length >= 3) {
    fvg = detectFVG(candles);
    if (fvg.hasBull) { score += 4; components.push({ key: 'fvg', score: 4, notes: 'bullish FVG' }); }
    if (fvg.hasBear) { score -= 4; components.push({ key: 'fvg', score: -4, notes: 'bearish FVG' }); }
  }

  // Market profile proxy (TPO-like) from ticks
  let profile = { poc: 0, vaLow: 0, vaHigh: 0 };
  if (ticks.length >= 50) {
    const { pocPrice, valueLow, valueHigh } = valueAreaFromTicks(ticks, 30);
    profile = { poc: pocPrice, vaLow: valueLow, vaHigh: valueHigh };
    if (price < valueLow) { score += 3; components.push({ key: 'profile', score: 3, notes: 'below value (mean reversion bias up)' }); }
    if (price > valueHigh) { score -= 3; components.push({ key: 'profile', score: -3, notes: 'above value (mean reversion bias down)' }); }
  }

  // Session/time-of-day bias (UTC): prefer :00/:15/:30/:45 alignment
  const m = new Date().getUTCMinutes();
  const inWindow = [0, 1, 14, 15, 16, 29, 30, 31, 44, 45, 46, 59].includes(m);
  if (!inWindow) { score -= 2; components.push({ key: 'session', score: -2, notes: 'off preferred minute windows' }); }

  // Cross-asset USD proxy (simple): average of recent USD majors
  let dxyBias = 0;
  try {
    const latest = wsBridge.getLatestQuoteMap();
    const majors = ['EUR/USD', 'GBP/USD', 'AUD/USD', 'NZD/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD'];
    const values: number[] = [];
    for (const s of majors) if (latest[s]) values.push(latest[s].price * (s.startsWith('USD/') ? -1 : 1));
    if (values.length >= 3) {
      const mean = values.reduce((a,b)=>a+b,0)/values.length;
      dxyBias = mean - values[0]; // very rough deviation
      if (dxyBias > 0) { score -= 2; components.push({ key: 'dxy', score: -2, notes: 'USD broad strength (risk-off bias)' }); }
      else if (dxyBias < 0) { score += 2; components.push({ key: 'dxy', score: 2, notes: 'USD broad weakness (risk-on bias)' }); }
    }
  } catch {}

  let side: SignalSide = 'NEUTRAL';
  if (score >= 58) side = 'CALL';
  else if (score <= 42) side = 'PUT';

  const confidence = Math.max(0, Math.min(100, Math.round(Math.abs(score - 50) * 2)));

  const entryHint = side === 'CALL'
    ? 'CALL on minor pullback; confluence at support/Fib; avoid chasing spikes'
    : side === 'PUT'
    ? 'PUT on minor bounce; confluence at resistance/Fib; avoid chasing drops'
    : 'Wait for clearer confluence of trend, RSI, S/R, and Fib';

  return {
    pair,
    expiry,
    side,
    confidence,
    entryHint,
    rationale,
    indicators: {
      emaFast,
      emaSlow,
      rsi: Math.round(rsiLast * 10) / 10,
      lastPrice: Math.round(price * 100000) / 100000,
      srWindowMin: Math.round(srMin * 100000) / 100000,
      srWindowMax: Math.round(srMax * 100000) / 100000,
    },
    timeframeUsed: tf,
    components,
    features: {
      ofi: { imbalance: ofi1.imbalance, pressure: ofi1.pressure },
      vol: { rv1m, rv5m },
      sweep,
      fvg,
      profile,
      session: { inWindow },
      dxyBias,
    },
  };
}

function inferStartPrice(pair: string): number {
  if (pair.includes("JPY")) return 150;
  if (pair.includes("BTC")) return 45000;
  if (pair.includes("ETH")) return 2500;
  return 1.1;
}
