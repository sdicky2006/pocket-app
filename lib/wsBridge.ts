import { chromium, Browser, Page, BrowserContext, WebSocket as PWWebSocket } from '@playwright/test';
import { EventEmitter } from 'events';
import zlib from 'zlib';

export type BridgeStatus = 'idle' | 'connecting' | 'connected' | 'stopped' | 'error';

class WSBridge {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private status: BridgeStatus = 'idle';
  private lastError: string | null = null;
  private activityLog: Array<{ ts: number; msg: string; level: 'info' | 'error' | 'warn' }> = [];
  private recentFrames: Array<{ direction: 'in' | 'out'; url: string; payload: string; ts: number }> = [];
  private frameEmitter = new EventEmitter();
  private seenSymbols = new Set<string>();
  private quotesBySymbol: Map<string, { symbol: string; price: number; ts: number }> = new Map();
  private tickHistoryBySymbol: Map<string, Array<{ ts: number; price: number; dir: -1 | 0 | 1 }>> = new Map();
  private quoteEmitter = new EventEmitter();
  private instrumentQuotesById: Map<string, { id: string; display: string; assetType: 'Currency' | 'Cryptocurrencies' | 'Commodities' | 'Stocks' | 'Indices'; price: number; ts: number }> = new Map();
  private payoutBySymbol: Map<string, { symbol: string; payout: number; ts: number }> = new Map();
  private instrumentPayoutById: Map<string, { id: string; payout: number; ts: number }> = new Map();
  private subscribeTemplate: { prefix: string; suffix: string; usesSlash: boolean } | null = null;
  private autoSubscribe = { enabled: true, intervalSec: 10, targetCount: 30 };
  private autoSubscribeTimer: any = null;
  private preferredSymbol: string | null = null;
  private autoTrade: {
    enabled: boolean;
    account: 'demo' | 'live';
    threshold: number; // percent
    amount: number; // currency units
    expiry: '30s'|'1m'|'2m'|'3m'|'5m'|'10m'|'15m'|'30m'|'1h';
    activeChartOnly: boolean;
    cooldownSec: number;
    lastTradeAt?: number;
    masaniello?: {
      enabled: boolean;
      bankroll: number;
      targetWins: number;
      winProbability: number;
      currentStep: number;
      minStake: number;
      maxStakePercent: number; // e.g., 0.02
    };
    allowNavigateToTrading?: boolean;
  } = { enabled: false, account: 'demo', threshold: 75, amount: 1, expiry: '1m', activeChartOnly: true, cooldownSec: 60, allowNavigateToTrading: false };
  private autoTradeTimer: any = null;

  private readonly allowedBase = new Set<string>([
    // Major/minor FX
    'USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD','CNY','RUB','TRY','SEK','NOK','DKK','PLN','HUF','CZK','ZAR','MXN','SGD','HKD','BRL','ILS','INR','KRW','SAR','AED',
    // Crypto
    'BTC','ETH','LTC','XRP','ADA','SOL','BNB','DOGE','DOT','TRX','AVAX','XLM','ATOM','ETC'
  ]);
  private readonly allowedQuote = new Set<string>([
    'USD','USDT','EUR','GBP','JPY','AUD','CAD','CHF','NZD'
  ]);

  private log(msg: string, level: 'info' | 'error' | 'warn' = 'info') {
    if (this.activityLog.length > 100) {
      this.activityLog.shift();
    }
    this.activityLog.push({ ts: Date.now(), msg, level });
    console.log(`[wsBridge] ${level.toUpperCase()}: ${msg}`);
  }

  private markStopped = () => {
    this.log('Session stopped (browser/page/context closed).', 'warn');
    this.status = 'stopped';
    this.browser = null;
    this.page = null;
  };

  private attachWSListeners(ctx: BrowserContext) {
    this.log('Attaching websocket listeners to browser context.');
    // @ts-ignore Playwright types may not include this event in all versions
    ctx.on('websocket', (socket: any) => {
      const url = socket.url();
      if (!/po\.market|pocketoption\.com/i.test(url)) return; // Filter to relevant websockets
      this.log(`New websocket opened: ${url}`);
      socket.on('framereceived', (data: any) => {
        const raw: string | Buffer = typeof data === 'string' ? data : Buffer.from(data);
        const candidates = this.decodePayloadCandidates(raw);
        const payload = candidates[0] || (typeof raw === 'string' ? raw : raw.toString('utf-8'));
        const frame = { direction: 'in' as const, url, payload, ts: Date.now() };
        this.frameEmitter.emit('frame', frame);
        if (this.recentFrames.length >= 20) this.recentFrames.shift();
        this.recentFrames.push(frame);
        this.log(`WS frame received from ${url}`, 'info');
        if (this.status === 'connecting') this.status = 'connected';
        // opportunistically harvest symbols from frames (check all decode candidates)
        try {
          const slashRe = /\b([A-Z]{2,6}\/[A-Z]{2,6})\b/g;
          const sixRe = /\b([A-Z]{6,7}(?:[_-]OTC\d*)?)\b/g;
          for (const cand of candidates) {
            const upper = cand.toUpperCase();
            let m: RegExpExecArray | null;
            while ((m = slashRe.exec(upper))) {
              const norm = this.normalizeSymbol(m[1]);
              if (norm) this.seenSymbols.add(norm);
            }
            while ((m = sixRe.exec(upper))) {
              const norm = this.normalizeSymbol(m[1]);
              if (norm) this.seenSymbols.add(norm);
            }
          }
        } catch {}
        // Try to parse quotes from JSON payloads across all candidates
        for (const p of candidates) {
          const qs = this.extractQuotesFromPayload(p);
          if (qs.length) {
            qs.forEach((q) => this.recordQuote(q));
            break;
          }
        }
      });
      socket.on('framesent', (data: any) => {
        const raw: string | Buffer = typeof data === 'string' ? data : Buffer.from(data);
        const payload = typeof raw === 'string' ? raw : raw.toString('utf-8');
        const frame = { direction: 'out' as const, url, payload, ts: Date.now() };
        this.frameEmitter.emit('frame', frame);
        if (this.recentFrames.length >= 20) this.recentFrames.shift();
        this.recentFrames.push(frame);
        // Try to learn a subscribe template from frames like 42["subscribe", {symbol:"EUR/USD_otc"}]
        try {
          const firstJsonIdx = payload.search(/[\[{]/);
          const candidate = firstJsonIdx > 0 ? payload.slice(firstJsonIdx) : payload;
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'string') {
            const evtName = parsed[0].toLowerCase();
            const obj = parsed[1];
            const idLike = obj?.symbol || obj?.pair || obj?.instrument || obj?.code || obj?.s;
            if (/sub/.test(evtName) && typeof idLike === 'string') {
              const usesSlash = /\//.test(idLike);
              // build prefix/suffix to splice new symbol
              const idx = candidate.indexOf(idLike);
              if (idx > 0) {
                const prefix = candidate.slice(0, idx);
                const suffix = candidate.slice(idx + idLike.length);
                this.subscribeTemplate = { prefix, suffix, usesSlash };
                this.log(`Learned subscribe template (usesSlash=${usesSlash})`);
              }
            }
          }
        } catch {}
      });
    });

    // Lifecycle safety: if the context or underlying browser/page closes, reset state so we can relaunch
    ctx.on('close', () => this.markStopped());
    // Playwright doesn't emit 'disconnected' on context, so also wire browser/page below when created
  }

  private async humanDelay(min = 120, max = 420) {
    const ms = Math.floor(min + Math.random() * Math.max(1, max - min));
    await new Promise((r) => setTimeout(r, ms));
  }

  private decodePayloadCandidates(data: string | Buffer): string[] {
    const out: string[] = [];
    try {
      if (typeof data === 'string') {
        out.push(data);
        // base64 decode attempt (be tolerant about padding/length)
        if (/^[A-Za-z0-9+/=\s]+$/.test(data)) {
          try { out.push(Buffer.from(data.replace(/\s+/g, ''), 'base64').toString('utf-8')); } catch {}
        }
      } else if (Buffer.isBuffer(data)) {
        out.push(data.toString('utf-8'));
        // gzip
        try { out.push(zlib.gunzipSync(data).toString('utf-8')); } catch {}
        // deflate
        try { out.push(zlib.inflateRawSync(data).toString('utf-8')); } catch {}
      }
    } catch {}
    // dedupe, keep only plausible JSON/text
    return Array.from(new Set(out.filter((s) => typeof s === 'string' && s.length > 0)));
  }

  private normalizeSymbol(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const original = String(raw).trim();

    // Capture optional suffix like _otc or -otc (case-insensitive, optional digits)
    const suffixMatch = original.match(/([_-]otc\d*)$/i);
    const suffix = suffixMatch ? suffixMatch[0] : '';

    // Work on the core without suffix for validation/formatting
    let core = suffix ? original.slice(0, -suffix.length) : original;
    core = core.toUpperCase().trim();

    // Allow hyphen form like ADA-USD -> ADA/USD
    if (/^[A-Z]{3,5}-[A-Z]{3,5}$/.test(core)) core = core.replace('-', '/');

    // Insert slash if common 6-letter FX (e.g., EURUSD -> EUR/USD)
    if (/^[A-Z]{6}$/.test(core)) core = `${core.slice(0,3)}/${core.slice(3)}`;

    // Validate core as BASE/QUOTE
    if (!/^[A-Z]{3}\/[A-Z]{3,5}$/.test(core)) return null;
    const [base, quote] = core.split('/') as [string, string];
    if (base === quote) return null;
    if (!this.allowedBase.has(base)) return null;
    if (!this.allowedQuote.has(quote)) return null;

    // Re-attach original suffix exactly as provided
    return `${base}/${quote}${suffix}`;
  }

  private recordQuote(q: { symbol: string; price: number; ts?: number }) {
    const symbol = this.normalizeSymbol(q.symbol);
    if (!symbol || !Number.isFinite(q.price)) return;
    const ts = q.ts ?? Date.now();
    this.quotesBySymbol.set(symbol, { symbol, price: q.price, ts });
    this.quoteEmitter.emit('quote', { symbol, price: q.price, ts });

    // Append to per-symbol tick history with direction
    const arr = this.tickHistoryBySymbol.get(symbol) ?? [];
    const prev = arr.length ? arr[arr.length - 1] : undefined;
    const dir: -1 | 0 | 1 = prev ? (q.price > prev.price ? 1 : q.price < prev.price ? -1 : 0) : 0;
    arr.push({ ts, price: q.price, dir });
    // Cap history per symbol (e.g., last ~5 minutes at high tick rates)
    if (arr.length > 5000) arr.splice(0, arr.length - 5000);
    this.tickHistoryBySymbol.set(symbol, arr);
  }

  private recordPayout(symOrId: string, payout: number, ts?: number) {
    if (!Number.isFinite(payout)) return;
    const when = ts ?? Date.now();
    const sym = this.normalizeSymbol(symOrId);
    if (sym) {
      this.payoutBySymbol.set(sym, { symbol: sym, payout, ts: when });
      return;
    }
    const id = String(symOrId || '').toUpperCase();
    if (!id) return;
    this.instrumentPayoutById.set(id, { id, payout, ts: when });
  }

  private classifyInstrumentId(idRaw: string): 'Currency' | 'Cryptocurrencies' | 'Commodities' | 'Stocks' | 'Indices' {
    const id = idRaw.toUpperCase();
    const core = id.replace(/([_-]OTC\d*)$/, '');
    const fxBases = this.allowedBase;
    const fxQuotes = this.allowedQuote;
    const cryptoBases = new Set<string>(['BTC','ETH','LTC','XRP','ADA','SOL','BNB','DOGE','DOT','TRX','AVAX','XLM','ATOM','ETC','BCH','SHIB','MATIC','LINK']);
    const commodityTokens = ['XAU','XAG','XPT','XPD','UKOIL','USOIL','BRENT','WTI','NG','XBR','XTI','XCU','XAL','COPPER','SILVER','GOLD'];
    const indexTokens = ['US30','US_30','DJI','SPX500','SP500','NAS100','NDX','GER40','DE30','UK100','FTSE100','FR40','CAC40','JP225','NIKKEI','HK50','HSI','AU200','ASX200'];

    // slash form
    if (/^[A-Z]{2,6}\/[A-Z]{2,6}/.test(core)) {
      const [base, quote] = core.split('/') as [string,string];
      if (cryptoBases.has(base)) return 'Cryptocurrencies';
      if (commodityTokens.includes(base)) return 'Commodities';
      if (fxBases.has(base) && fxQuotes.has(quote)) return 'Currency';
      return 'Stocks';
    }
    // 6-letter FX/crypto like EURUSD, XAUUSD, BTCUSD
    if (/^[A-Z]{6,7}$/.test(core)) {
      const base = core.slice(0, core.length - 3);
      const quote = core.slice(-3);
      if (cryptoBases.has(base)) return 'Cryptocurrencies';
      if (commodityTokens.includes(base)) return 'Commodities';
      if (fxBases.has(base) && fxQuotes.has(quote)) return 'Currency';
      return 'Stocks';
    }
    // Known indices tokens
    if (indexTokens.includes(core)) return 'Indices';
    // Heuristic: pure alphabetic <=5 chars likely stock ticker
    if (/^[A-Z]{1,5}$/.test(core)) return 'Stocks';
    return 'Currency';
  }

  private displayFromId(idRaw: string): string {
    const id = idRaw.toUpperCase();
    const suffixMatch = id.match(/([_-]OTC\d*)$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    let core = suffix ? id.slice(0, -suffix.length) : id;
    if (/^[A-Z]{6,7}$/.test(core)) {
      const base = core.slice(0, core.length - 3);
      const quote = core.slice(-3);
      return `${base}/${quote}${suffix}`;
    }
    if (/^[A-Z]{2,6}\/[A-Z]{2,6}$/.test(core)) return `${core}${suffix}`;
    return id; // fallback
  }

  private recordInstrumentQuote(idRaw: string, price: number, ts?: number) {
    if (!idRaw || !Number.isFinite(price)) return;
    const id = idRaw.toUpperCase();
    const display = this.displayFromId(id);
    const assetType = this.classifyInstrumentId(id);
    const when = ts ?? Date.now();
    this.instrumentQuotesById.set(id, { id, display, assetType, price, ts: when });
    // Emit a generic quote event so clients receive live prices for non-FX assets too
    try {
      this.quoteEmitter.emit('quote', { symbol: display, price, ts: when });
    } catch {}
  }

  private extractQuotesFromPayload(payload: string): Array<{ symbol: string; price: number; ts?: number }> {
    const out: Array<{ symbol: string; price: number; ts?: number }> = [];
    if (!payload) return out;

    // Try to strip Engine.IO / Socket.IO numeric prefixes (e.g., "42", "430", etc.)
    let candidate = payload.trim();
    const firstJsonIdx = candidate.search(/[\[{]/);
    if (firstJsonIdx > 0) candidate = candidate.slice(firstJsonIdx);

    const tryParse = (text: string) => {
      try { return JSON.parse(text); } catch { return null; }
    };

    const pushIfQuote = (node: any) => {
      const idLike = node?.symbol || node?.pair || node?.asset || node?.instrument || node?.code || node?.sym || node?.s;
      const symbolCandidate = this.normalizeSymbol(idLike);
      const priceCandidate = [node?.price, node?.last, node?.bid, node?.ask, node?.bidPrice, node?.askPrice, node?.rate, node?.p, node?.c]
        .map((v: any) => typeof v === 'string' ? parseFloat(v) : v)
        .find((v: any) => typeof v === 'number' && Number.isFinite(v));
      if (typeof priceCandidate === 'number') {
        if (symbolCandidate) {
          out.push({ symbol: symbolCandidate, price: priceCandidate, ts: Date.now() });
        } else if (idLike) {
          // Non-FX instrument with id-like code
          this.recordInstrumentQuote(String(idLike), priceCandidate, Date.now());
        }
      }
      // Detect payout percentages
      const payoutKeys = ['payout','profit','profitability','percent','percentage'];
      for (const k of payoutKeys) {
        if (node && Object.prototype.hasOwnProperty.call(node, k)) {
          const raw = (node as any)[k];
          const val = typeof raw === 'string' ? parseFloat(raw) : raw;
          if (typeof val === 'number' && Number.isFinite(val) && val >= 1 && val <= 100) {
            if (symbolCandidate) this.recordPayout(symbolCandidate, val, Date.now());
            else if (idLike) this.recordPayout(String(idLike), val, Date.now());
          }
        }
      }
    };

    const walk = (node: any) => {
      if (node == null) return;
      if (Array.isArray(node)) {
        // Case: ["EVENT", { ... }]
        if (node.length >= 2 && typeof node[0] === 'string' && typeof node[1] === 'object') {
          pushIfQuote(node[1]);
        }
        // Case: ["EURJPY_otc", ts, price] or ["EURJPY_otc", price]
        if (node.length >= 2 && typeof node[0] === 'string') {
          const sym = this.normalizeSymbol(node[0]);
          const nums = node.slice(1).filter((x) => typeof x === 'number') as number[];
          const price = nums.length >= 2 ? nums[nums.length - 1] : (nums[0] ?? undefined);
          if (sym && typeof price === 'number' && Number.isFinite(price)) {
            out.push({ symbol: sym, price, ts: Date.now() });
          }
          // Also record raw instrument id for non-FX assets
          if (!sym && typeof price === 'number' && Number.isFinite(price)) {
            this.recordInstrumentQuote(node[0], price, Date.now());
          }
          // If an array carries a plausible payout (e.g., ["EURUSD_otc", ..., payout%])
          const payoutVal = nums.find((n) => n >= 1 && n <= 100);
          if (typeof payoutVal === 'number') {
            if (sym) this.recordPayout(sym, payoutVal, Date.now());
            else this.recordPayout(String(node[0]), payoutVal, Date.now());
          }
        }
        for (const item of node) walk(item);
        return;
      }
      if (typeof node === 'object') {
        pushIfQuote(node);
        for (const k of Object.keys(node)) walk(node[k]);
      }
    };

    // Try parsing as a single JSON object/array first
    let parsed = tryParse(candidate);
    if (parsed) {
      walk(parsed);
      return out;
    }

    // If payload contains multiple JSON blobs, extract them greedily
    const jsonMatches = candidate.match(/[\[{][\s\S]*[\]}]/g);
    if (jsonMatches) {
      for (const m of jsonMatches) {
        const p = tryParse(m);
        if (p) walk(p);
      }
    }

    return out;
  }

  getLatestQuotes(): Array<{ symbol: string; price: number; ts: number }> {
    return Array.from(this.quotesBySymbol.values()).sort((a, b) => b.ts - a.ts);
  }

  onQuote(listener: (q: { symbol: string; price: number; ts: number }) => void) {
    this.quoteEmitter.on('quote', listener);
    return () => this.quoteEmitter.off('quote', listener);
  }

  getInstruments(): Array<{ id: string; symbol: string; assetType: 'Currency' | 'Cryptocurrencies' | 'Commodities' | 'Stocks' | 'Indices'; price: number; lastUpdate: number }> {
    const list: Array<{ id: string; symbol: string; assetType: 'Currency' | 'Cryptocurrencies' | 'Commodities' | 'Stocks' | 'Indices'; price: number; lastUpdate: number; payout?: number }> = [];
    // Include normalized FX/crypto quotes
    for (const { symbol, price, ts } of this.quotesBySymbol.values()) {
      const id = symbol.replace('/', '');
      const assetType = this.classifyInstrumentId(id);
      const payout = this.payoutBySymbol.get(symbol)?.payout;
      list.push({ id, symbol, assetType, price, lastUpdate: ts, payout });
    }
    // Include any raw instrument quotes not represented above
    for (const entry of this.instrumentQuotesById.values()) {
      const existing = list.find((x) => x.id === entry.id);
      if (!existing) {
        const payout = this.instrumentPayoutById.get(entry.id)?.payout;
        list.push({ id: entry.id, symbol: entry.display, assetType: entry.assetType, price: entry.price, lastUpdate: entry.ts, payout });
      }
    }
    // Sort by symbol
    return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  getDiscoveredSymbols(): string[] {
    return Array.from(this.seenSymbols.values()).filter(Boolean).sort();
  }

  getAutoTradeConfig() {
    return { ...this.autoTrade };
  }

  setAutoTradeConfig(cfg: Partial<typeof this.autoTrade>) {
    this.autoTrade = { ...this.autoTrade, ...cfg };
    if (this.autoTrade.enabled) this.ensureAutoTradeLoop(); else this.stopAutoTradeLoop();
  }

  getAutoSubscribeConfig() { return { ...this.autoSubscribe }; }
  setAutoSubscribeConfig(cfg: Partial<typeof this.autoSubscribe>) {
    this.autoSubscribe = { ...this.autoSubscribe, ...cfg };
    if (this.autoSubscribe.enabled) this.ensureAutoSubscribeLoop(); else this.stopAutoSubscribeLoop();
  }

  private stopAutoTradeLoop() {
    if (this.autoTradeTimer) { clearInterval(this.autoTradeTimer); this.autoTradeTimer = null; }
  }

  private ensureAutoTradeLoop() {
    if (this.autoTradeTimer) return;
    this.autoTradeTimer = setInterval(() => this.autoTradeTick().catch(()=>{}), 5000);
  }

  private stopAutoSubscribeLoop() {
    if (this.autoSubscribeTimer) { clearInterval(this.autoSubscribeTimer); this.autoSubscribeTimer = null; }
  }
  private ensureAutoSubscribeLoop() {
    if (this.autoSubscribeTimer) return;
    this.autoSubscribeTimer = setInterval(() => this.autoSubscribeTick().catch(()=>{}), Math.max(2, this.autoSubscribe.intervalSec) * 1000);
  }

  private async autoSubscribeTick() {
    try {
      if (!this.page) return;
      if (this.status !== 'connected') return;
      if (!this.autoSubscribe.enabled) return;
      const tpl = this.subscribeTemplate;
      if (!tpl) { this.log('AutoSubscribe: no subscribe template learned yet', 'warn'); return; }
      const { prefix, suffix, usesSlash } = tpl;
      // Choose up to targetCount discovered symbols to subscribe/refresh
      const discovered = this.getDiscoveredSymbols();
      if (!discovered.length) return;
      const targetN = Math.max(5, Math.min(this.autoSubscribe.targetCount, discovered.length));
      const selection = discovered.slice(0, targetN);
      const payloads = selection.map((sym) => `${prefix}${usesSlash ? sym : sym.replace('/', '')}${suffix}`);
      await this.page.evaluate((payloads) => {
        try {
          // @ts-ignore
          const g = window as any;
          const sockets: WebSocket[] = (g.__SOCKETS__ || []).filter((ws: WebSocket) => ws && ws.readyState === 1);
          const ws: WebSocket | undefined = sockets[0];
          if (!ws) return;
          for (const p of payloads) {
            try { ws.send(p); } catch {}
          }
        } catch {}
      }, payloads);
      this.log(`AutoSubscribe: sent ${payloads.length} subscribe frames`);
    } catch (e: any) {
      this.log(`AutoSubscribe error: ${e?.message || e}`, 'error');
    }
  }

  private async getActiveChartSymbol(): Promise<string | null> {
    try {
      if (!this.page) return null;
      const sym = await this.page.evaluate(() => {
        const re = /\b([A-Z]{3}\/[A-Z]{3,5}(?:[_-]otc\d*)?)\b/i;
        const scan = (root: Element | Document): string | null => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let n: Node | null;
          while ((n = walker.nextNode())) {
            const m = re.exec((n.textContent || '').toUpperCase());
            if (m) return m[1];
          }
          return null;
        };
        const head = document.querySelector('header') || document.body;
        return scan(head);
      });
      return this.normalizeSymbol(sym) as string | null;
    } catch { return null; }
  }

  private async switchAccountIfNeeded(target: 'demo'|'live') {
    if (!this.page) return;
    try {
      // Heuristic: Click account switcher and select Demo/Live by visible text
      const switcher = this.page.locator('button:has-text("Demo"), button:has-text("Live"), [role="button"]:has-text("Demo"), [role="button"]:has-text("Live")').first();
      if (await switcher.count()) {
        await switcher.hover().catch(()=>{});
        await this.humanDelay(150, 350);
        await switcher.click({ timeout: 2000 }).catch(()=>{});
        await this.humanDelay(120, 260);
      }
      const choice = this.page.locator(`text=${target === 'demo' ? 'Demo' : 'Live'}`).first();
      if (await choice.count()) {
        await choice.scrollIntoViewIfNeeded().catch(()=>{});
        await choice.hover().catch(()=>{});
        await this.humanDelay(160, 380);
        await choice.click({ timeout: 2000 }).catch(()=>{});
        await this.humanDelay(220, 420);
      }
    } catch {}
  }

  private async setAmountIfPossible(amount: number) {
    if (!this.page) return;
    try {
      const input = this.page.locator('input[type="number"], input[aria-label*="amount" i], input[name*="amount" i]').first();
      if (!(await input.count())) return;
      await input.scrollIntoViewIfNeeded().catch(()=>{});
      await input.hover().catch(()=>{});
      await this.humanDelay(120, 240);
      await input.click({ clickCount: 3 }).catch(()=>{});
      await this.humanDelay(100, 200);
      const s = String(Math.round(amount));
      for (const ch of s) {
        await this.page.keyboard.type(ch, { delay: 40 + Math.floor(Math.random() * 120) });
      }
      await this.humanDelay(150, 300);
    } catch {}
  }

  private async clickSide(side: 'CALL'|'PUT') {
    if (!this.page) return false;
    try {
      if (side === 'CALL') {
        const btn = this.page.locator('button:has-text("BUY"), button:has-text("CALL"), button:has-text("HIGHER"), button:has-text("UP"), [role="button"]:has-text("BUY"), [role="button"]:has-text("CALL")').first();
        if (!(await btn.count())) return false;
        await btn.scrollIntoViewIfNeeded().catch(()=>{});
        await btn.hover().catch(()=>{});
        await this.humanDelay(120, 320);
        return await btn.click({ timeout: 2000 }).then(()=>true).catch(()=>false);
      } else {
        const btn = this.page.locator('button:has-text("SELL"), button:has-text("PUT"), button:has-text("LOWER"), button:has-text("DOWN"), [role="button"]:has-text("SELL"), [role="button"]:has-text("PUT")').first();
        if (!(await btn.count())) return false;
        await btn.scrollIntoViewIfNeeded().catch(()=>{});
        await btn.hover().catch(()=>{});
        await this.humanDelay(120, 320);
        return await btn.click({ timeout: 2000 }).then(()=>true).catch(()=>false);
      }
    } catch { return false; }
  }

  private async pickFallbackSymbol(): Promise<string | null> {
    try {
      const list = this.getInstruments();
      const now = Date.now();
      const recent = list.filter(x => Number.isFinite(x.price) && now - x.lastUpdate < 30_000);
      if (recent.length === 0) return null;
      // Pick most recently updated symbol
      const best = recent.sort((a, b) => b.lastUpdate - a.lastUpdate)[0];
      return best?.symbol || null;
    } catch { return null; }
  }

  private async ensureTradeUiReady(): Promise<boolean> {
    try {
      if (!this.page) return false;
      const hasButtons = await this.page.locator('button:has-text("BUY"), button:has-text("CALL"), button:has-text("HIGHER"), button:has-text("UP"), [role="button"]:has-text("BUY"), [role="button"]:has-text("CALL")').first().isVisible({ timeout: 2000 }).catch(()=>false)
        || await this.page.locator('button:has-text("SELL"), button:has-text("PUT"), button:has-text("LOWER"), button:has-text("DOWN"), [role="button"]:has-text("SELL"), [role="button"]:has-text("PUT")').first().isVisible({ timeout: 2000 }).catch(()=>false);
      if (hasButtons) return true;
      // If allowed, try navigating safely to a trading page without disrupting login
      if (this.autoTrade.allowNavigateToTrading) {
        try {
          const url = this.page.url();
          if (!/pocketoption\.com\/.+(trading|demo-quick-high-low)/i.test(url)) {
            this.log('AutoTrade: navigating to trading page to ensure buttons are visible');
            await this.page.goto('https://pocketoption.com/en/trading/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
            await this.humanDelay(400, 800);
          }
        } catch {}
        const again = await this.page.locator('button:has-text("BUY"), button:has-text("CALL"), button:has-text("HIGHER"), button:has-text("UP"), [role="button"]:has-text("BUY"), [role="button"]:has-text("CALL")').first().isVisible({ timeout: 2000 }).catch(()=>false)
          || await this.page.locator('button:has-text("SELL"), button:has-text("PUT"), button:has-text("LOWER"), button:has-text("DOWN"), [role="button"]:has-text("SELL"), [role="button"]:has-text("PUT")').first().isVisible({ timeout: 2000 }).catch(()=>false);
        return !!again;
      }
      return false;
    } catch { return false; }
  }

  private async autoTradeTick() {
    if (this.status !== 'connected') return;
    const cfg = this.autoTrade;
    if (!cfg.enabled) return;
    if (cfg.lastTradeAt && Date.now() - cfg.lastTradeAt < cfg.cooldownSec * 1000) return;
    let symbol = cfg.activeChartOnly ? await this.getActiveChartSymbol() : await this.pickFallbackSymbol();
    // If user set preferred symbol, try that first when not using activeChartOnly
    if (!cfg.activeChartOnly && this.preferredSymbol) symbol = this.preferredSymbol;
    if (!symbol) { this.log('AutoTrade: no symbol resolved (activeChartOnly might be off and no recent instruments)', 'warn'); return; }
    const uiReady = await this.ensureTradeUiReady();
    if (!uiReady) { this.log('AutoTrade: trade UI not ready (BUY/SELL buttons not visible)', 'warn'); return; }
    try {
      const { analyzePocketOptionSignal } = await import('./signalEngine');
      const res = await analyzePocketOptionSignal({ pair: symbol as any, expiry: cfg.expiry });
      if (res.side === 'NEUTRAL') { this.log(`AutoTrade: neutral signal for ${symbol}, skipping`); return; }
      if (res.confidence < cfg.threshold) { this.log(`AutoTrade: below threshold for ${symbol} (${res.confidence}% < ${cfg.threshold}%)`); return; }
      if ((res.side === 'CALL' || res.side === 'PUT')) {
        await this.switchAccountIfNeeded(cfg.account);
        let stake = cfg.amount;
        const m = cfg.masaniello;
        if (m?.enabled && m.bankroll > 0 && m.targetWins > 0 && m.winProbability > 0 && m.winProbability < 1) {
          const step = Math.max(1, Math.min(m.targetWins, m.currentStep || 1));
          const factor = (m.targetWins - (step - 1)) / m.targetWins;
          stake = Math.max(m.minStake || 1, Math.min(m.bankroll * (m.maxStakePercent || 0.02), m.bankroll * factor * m.winProbability));
        }
        await this.setAmountIfPossible(stake);
        const ok = await this.clickSide(res.side);
        this.log(`AutoTrade ${ok ? 'EXECUTED' : 'FAILED'} ${symbol} ${res.side} ${cfg.expiry} @${stake} conf=${res.confidence}%`);
        if (ok) {
          this.autoTrade.lastTradeAt = Date.now();
          if (m?.enabled) this.autoTrade.masaniello = { ...m, currentStep: Math.min((m.currentStep || 1) + 1, m.targetWins) } as any;
        }
      }
    } catch (e: any) {
      this.log(`autoTradeTick error: ${e?.message || e}`, 'error');
    }
  }

  /**
   * Return recent ticks for a normalized symbol (e.g., EUR/USD_otc) within lookbackMs.
   */
  getRecentTicks(symbol: string, lookbackMs: number): Array<{ ts: number; price: number; dir: -1 | 0 | 1 }> {
    const norm = this.normalizeSymbol(symbol);
    if (!norm) return [];
    const arr = this.tickHistoryBySymbol.get(norm) ?? [];
    if (!arr.length) return [];
    const cutoff = Date.now() - Math.max(lookbackMs, 0);
    // arr is append-only; find first index >= cutoff
    let i = arr.length - 1;
    while (i >= 0 && arr[i].ts >= cutoff) i--;
    return arr.slice(Math.max(0, i + 1));
  }

  /**
   * Provide a snapshot of latest quotes map for cross-asset computations.
   */
  getLatestQuoteMap(): Record<string, { price: number; ts: number }> {
    const out: Record<string, { price: number; ts: number }> = {};
    for (const [sym, q] of this.quotesBySymbol.entries()) out[sym] = { price: q.price, ts: q.ts };
    return out;
  }

  private async detectConnected(): Promise<boolean> {
    try {
      if (!this.page) {
        this.log('detectConnected: Page not available.', 'warn');
        return false;
      }
      this.log('detectConnected: Checking for connection indicators...');

      const url = this.page.url();
      this.log(`detectConnected: Current URL is ${url}`);
      if (/pocketoption\.com\/.*(trading|demo-quick-high-low)/i.test(url)) {
          this.log('detectConnected: Trading URL detected. SUCCESS.');
          return true;
      }

      const buyBtn = await this.page.locator('button:has-text("BUY")').first().isVisible({ timeout: 500 }).catch(() => false);
      this.log(`detectConnected: "BUY" button visible: ${buyBtn}`);
      if (buyBtn) return true;
      const sellBtn = await this.page.locator('button:has-text("SELL")').first().isVisible({ timeout: 500 }).catch(() => false);
      this.log(`detectConnected: "SELL" button visible: ${sellBtn}`);
      if (sellBtn) return true;
      const currenciesTab = await this.page.locator('text=Currencies').first().isVisible({ timeout: 500 }).catch(() => false);
      this.log(`detectConnected: "Currencies" tab visible: ${currenciesTab}`);
      if (currenciesTab) return true;
      
      this.log('detectConnected: No definitive connection indicators found.', 'warn');
      return false;
    } catch (e: any) {
      this.log(`detectConnected: Error during detection: ${e.message}`, 'error');
      return false;
    }
  }

  setPreferredSymbol(sym: string | null) {
    const n = this.normalizeSymbol(sym || '');
    this.preferredSymbol = n;
  }

  getPreferredSymbol(): string | null {
    return this.preferredSymbol;
  }

  async getStatus() {
    // Auto-promote to connected if we detect session after manual login
    if (this.status === 'connecting' && (await this.detectConnected())) {
      this.log('Status promoted from "connecting" to "connected" based on UI detection.');
      this.status = 'connected';
    }
    return { 
      status: this.status, 
      lastError: this.lastError,
      activityLog: this.activityLog.slice().reverse(),
      recentFrames: this.recentFrames.slice().reverse(),
    };
  }

  async start(email: string, password: string) {
    if (this.page && !this.page.isClosed() && this.browser && this.browser.isConnected() && (this.status === 'connected' || this.status === 'connecting')) {
      return this.getStatus();
    }
    this.status = 'connecting';
    this.lastError = null;
    try {
      this.browser = await chromium.launch({ headless: true });
      const ctx = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
      });
      this.attachWSListeners(ctx);
      this.page = await ctx.newPage();
      this.page.on('close', this.markStopped);
      this.browser.on('disconnected', this.markStopped);

      // Navigate to Pocket Option login page (placeholder URL)
      await this.page.goto('https://pocketoption.com/en/login/', { waitUntil: 'domcontentloaded' });

      // Fill login form (selectors may need adjustment)
      await this.page.fill('input[type="email"], input[name="email"]', email);
      await this.page.fill('input[type="password"], input[name="password"]', password);
      await this.page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');

      // Wait briefly then detect
      await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      const connected = await this.detectConnected();
      this.status = connected ? 'connected' : 'error';
      if (!connected) this.lastError = 'Login not confirmed (check selectors/2FA/captcha).';
      return this.getStatus();
    } catch (e: any) {
      this.status = 'error';
      this.lastError = e?.message || String(e);
      return this.getStatus();
    }
  }

  async startManual() {
    if (this.page && !this.page.isClosed() && this.browser && this.browser.isConnected() && (this.status === 'connected' || this.status === 'connecting')) {
      this.log('startManual: Bridge already running, bringing page to front.');
      await this.page.bringToFront().catch(() => {});
      return this.getStatus();
    }
    this.status = 'connecting';
    this.lastError = null;
    this.activityLog = [];
    this.recentFrames = [];
    this.log('startManual: Initiating manual connection...');
    try {
      // Try default bundled Chromium first; fallback to system Chrome/Edge if needed
      try {
        this.log('startManual: Attempting to launch bundled Playwright Chromium...');
        this.browser = await chromium.launch({ headless: false });
        this.log('startManual: Bundled Chromium launched successfully.');
      } catch (e) {
        this.log('startManual: Bundled Chromium failed, trying system Chrome...', 'warn');
        try {
          // Chrome channel
          // @ts-ignore channel is allowed by Playwright when available
          this.browser = await chromium.launch({ headless: false, channel: 'chrome' } as any);
          this.log('startManual: System Chrome launched successfully.');
        } catch (e2) {
          this.log('startManual: System Chrome failed, trying system Edge...', 'warn');
          // Edge channel
          // @ts-ignore channel is allowed by Playwright when available
          this.browser = await chromium.launch({ headless: false, channel: 'msedge' } as any);
          this.log('startManual: System Edge launched successfully.');
        }
      }
      this.log('startManual: Creating new browser context.');
      const ctx = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
      });
      this.attachWSListeners(ctx);
      this.log('startManual: Creating new page.');
      this.page = await ctx.newPage();

      this.page.on('frameattached', frame => this.log(`Frame attached: ${frame.url()}`, 'info'));
      this.page.on('framedetached', frame => this.log(`Frame detached: ${frame.url()}`, 'warn'));

      // Add an initialization script to spy on WebSocket creation from within the page context.
      // This is a more robust way to detect websockets if the standard Playwright listener fails.
      await this.page.addInitScript(() => {
        const OriginalWebSocket = window.WebSocket;
        const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
          let binary = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          // @ts-ignore
          return btoa(binary);
        };
        // @ts-ignore
        window.WebSocket = function(a:any, b?:any) {
          // @ts-ignore
          const ws = new OriginalWebSocket(a, b);
          try {
            const url = String(a || '');
            console.log(`[WebSocketInterceptor] Page is creating new WebSocket to: ${url}`);
            try {
              // Capture sockets for later programmatic send
              // @ts-ignore
              const g = window as any;
              g.__SOCKETS__ = g.__SOCKETS__ || [];
              g.__SOCKETS__.push(ws);
            } catch {}
            const originalSend = ws.send.bind(ws);
            ws.send = function(body: any) {
              try {
                if (body instanceof Blob) {
                  const fr = new FileReader();
                  fr.onload = () => {
                    try { console.log(`[WS:OUT] ${url} ${String(fr.result || '')}`); } catch {}
                  };
                  fr.readAsText(body);
                } else if (body instanceof ArrayBuffer) {
                  console.log(`[WS:OUT] ${url} ${arrayBufferToBase64(body)}`);
                } else {
                  console.log(`[WS:OUT] ${url} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
                }
              } catch {}
              return originalSend(body);
            } as typeof ws.send;
            ws.addEventListener('message', (evt: MessageEvent) => {
              try {
                const data: any = evt?.data;
                if (data instanceof Blob) {
                  const fr = new FileReader();
                  fr.onload = () => {
                    try { console.log(`[WS:IN] ${url} ${String(fr.result || '')}`); } catch {}
                  };
                  fr.readAsText(data);
                } else if (data instanceof ArrayBuffer) {
                  console.log(`[WS:IN] ${url} ${arrayBufferToBase64(data)}`);
                } else {
                  console.log(`[WS:IN] ${url} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
                }
              } catch {}
            });
          } catch {}
          return ws;
        } as any;
      });

      // Listen for the console messages produced by our interception script.
      this.page.on('console', msg => {
        const text = msg.text();
        if (text.startsWith('[WebSocketInterceptor]')) {
          this.log(text, 'info');
          return;
        }
        const m = text.match(/^\[(WS:IN|WS:OUT)\]\s+(\S+)\s+([\s\S]*)$/);
        if (m) {
          const dir = m[1] === 'WS:IN' ? 'in' : 'out';
          const url = m[2];
          const payload = m[3] || '';
          const frame = { direction: dir as 'in' | 'out', url, payload, ts: Date.now() };
          if (this.recentFrames.length >= 20) this.recentFrames.shift();
          this.recentFrames.push(frame);
          if (this.status === 'connecting') this.status = 'connected';

          // Parse payloads captured via in-page spy as well
          try {
            const candidates = this.decodePayloadCandidates(payload as any);
            // Harvest symbols
            const slashRe = /\b([A-Z]{2,6}\/[A-Z]{2,6})\b/g;
            const sixRe = /\b([A-Z]{6,7}(?:[_-]OTC\d*)?)\b/g;
            for (const cand of candidates) {
              const upper = cand.toUpperCase();
              let mm: RegExpExecArray | null;
              while ((mm = slashRe.exec(upper))) {
                const norm = this.normalizeSymbol(mm[1]);
                if (norm) this.seenSymbols.add(norm);
              }
              while ((mm = sixRe.exec(upper))) {
                const norm = this.normalizeSymbol(mm[1]);
                if (norm) this.seenSymbols.add(norm);
              }
            }
            // Extract quotes
            for (const cand of candidates) {
              const qs = this.extractQuotesFromPayload(cand);
              if (qs.length) { qs.forEach((q) => this.recordQuote(q)); break; }
            }
          } catch {}
        }
      });

      this.page.on('close', this.markStopped);
      this.browser.on('disconnected', this.markStopped);

      this.log('startManual: Navigating to Pocket Option login page...');
      await this.page.goto('https://pocketoption.com/en/login/', { waitUntil: 'domcontentloaded' });
      this.log('startManual: Navigation complete. Waiting for user to log in.');

      // Do not fill credentials; user performs manual login to mitigate captchas/2FA.
      // We immediately return; status endpoint will promote to connected once UI is verified.
      return this.getStatus();
    } catch (e: any) {
      this.status = 'error';
      this.lastError = e?.message || String(e);
      this.log(`startManual: FATAL ERROR - ${this.lastError}`, 'error');
      return this.getStatus();
    }
  }

  async stop() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.status = 'stopped';
      return this.getStatus();
    } catch (e: any) {
      this.status = 'error';
      this.lastError = e?.message || String(e);
      return this.getStatus();
    }
  }

  onFrame(listener: (evt: { direction: 'in' | 'out'; url: string; payload: string; ts: number }) => void) {
    this.frameEmitter.on('frame', listener);
    return () => this.frameEmitter.off('frame', listener);
  }

  /**
   * Scrape available trading pairs from the Pocket Option web UI.
   * Requires an active page session (manual or automated login).
   */
  async getPairs(): Promise<Array<{ id: string; symbol: string; name: string; category: 'major' | 'minor' | 'exotic' | 'crypto'; price: number; change: number; changePercent: number; volume: number; isActive: boolean; lastUpdate: number }>> {
    if (!this.page) {
        this.log('getPairs: Cannot scrape, bridge not started or page is not available.', 'warn');
        return [];
    };
    try {
      // Non-invasive: never change user's current Pocket Option page here
      const url = this.page.url();
      const isTradingUi = /pocketoption\.com\/.+\/(trading|demo-quick-high-low)\//i.test(url) || /pocketoption\.com\/(en|ru|es)?\/?trading\/?$/i.test(url);
      if (!isTradingUi) {
        this.log('getPairs: Skipping DOM scrape (not on trading UI). Will use websocket-seen symbols only.');
      }

      // Heuristic: collect any text that looks like a pair symbol (e.g., EUR/USD, GBP/USD, BTC/USD) – only if already on trading UI
      const symbolsFromDom: string[] = isTradingUi ? await this.page.evaluate(() => {
        const re = /\b([A-Z]{3}\/[A-Z]{3}|BTC\/USD|ETH\/USD|[A-Z]{3}\/(?:USD|USDT|EUR|GBP|JPY))\b/g;
        const set = new Set<string>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const t = (n.textContent || '').toUpperCase();
          let m: RegExpExecArray | null;
          while ((m = re.exec(t))) set.add(m[1]);
        }
        // Also scan common attributes
        document.querySelectorAll('[data-symbol], [data-asset], [title]').forEach((el) => {
          const vals = [el.getAttribute('data-symbol'), el.getAttribute('data-asset'), el.getAttribute('title')];
          for (const v of vals) {
            if (!v) continue;
            const t = v.toUpperCase();
            const m = /\b([A-Z]{3}\/[A-Z]{3}|BTC\/USD|ETH\/USD|[A-Z]{3}\/(?:USD|USDT|EUR|GBP|JPY))\b/.exec(t);
            if (m) set.add(m[1]);
          }
        });
        return Array.from(set);
      }) : [];

      const symbols = new Set<string>([...symbolsFromDom, ...Array.from(this.seenSymbols)]);

      const makeName = (s: string) => {
        const [b, q] = s.split('/') as [string, string];
        const names: Record<string, string> = {
          EUR: 'Euro', USD: 'US Dollar', GBP: 'British Pound', JPY: 'Japanese Yen', AUD: 'Australian Dollar', CAD: 'Canadian Dollar', CHF: 'Swiss Franc', NZD: 'New Zealand Dollar', BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', CNY: 'Chinese Yuan', RUB: 'Russian Ruble', TRY: 'Turkish Lira'
        };
        const bn = names[b] || b;
        const qn = names[q] || q;
        return `${bn} / ${qn}`;
      };

      const now = Date.now();
      const pairs = Array.from(symbols)
        .map((symbol) => this.normalizeSymbol(symbol))
        .filter((s): s is string => !!s)
        .slice(0, 300)
        .map((symbol) => {
        const id = symbol.replace('/', '');
        const category: 'major' | 'minor' | 'exotic' | 'crypto' = /BTC|ETH/.test(symbol) ? 'crypto' : symbol.endsWith('/USD') ? 'major' : 'minor';
        return {
          id,
          symbol,
          name: makeName(symbol),
          category,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          isActive: true,
          lastUpdate: now,
        };
      });

      return pairs;
    } catch (e: any) {
      this.lastError = e?.message || String(e);
      return [];
    }
  }
}

export const wsBridge = new WSBridge();
