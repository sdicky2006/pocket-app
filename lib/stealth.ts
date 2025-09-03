let uaIndex = 0;
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

export async function randomHumanDelay(minMs = 250, maxMs = 900) {
  const d = Math.max(minMs, Math.floor(minMs + Math.random() * (maxMs - minMs)));
  await new Promise((r) => setTimeout(r, d));
}

export function getRotatingUserAgent() {
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return USER_AGENTS[uaIndex];
}

export function randomizeHeaders(base: Record<string, string> = {}) {
  const acceptLang = ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'en;q=0.8'][Math.floor(Math.random() * 3)];
  const dnt = Math.random() > 0.5 ? '1' : '0';
  return {
    'user-agent': getRotatingUserAgent(),
    'accept-language': acceptLang,
    'dnt': dnt,
    ...base,
  } as Record<string, string>;
}

export function jitterSeconds(baseSec: number, pct = 0.3) {
  const delta = baseSec * pct;
  const off = (Math.random() - 0.5) * 2 * delta;
  return Math.max(1, Math.floor(baseSec + off));
}

// Very simple in-memory token bucket limiter per key
const bucket = new Map<string, { tokens: number; ts: number }>();
export function allowRequest(key: string, capacity = 10, refillPerSec = 5) {
  const now = Date.now();
  const cur = bucket.get(key) || { tokens: capacity, ts: now };
  const elapsed = (now - cur.ts) / 1000;
  const refill = elapsed * refillPerSec;
  cur.tokens = Math.min(capacity, cur.tokens + refill);
  cur.ts = now;
  if (cur.tokens >= 1) {
    cur.tokens -= 1;
    bucket.set(key, cur);
    return true;
  }
  bucket.set(key, cur);
  return false;
}
