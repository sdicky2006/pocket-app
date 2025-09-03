type CacheEntry = { value: any; expiresAt: number };

const memoryStore = new Map<string, CacheEntry>();

function now(): number {
  return Date.now();
}

function isExpired(entry: CacheEntry): boolean {
  return now() > entry.expiresAt;
}

function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null as any;
  try {
    // Avoid static import so app works without dependency
    const req: any = (global as any).require || eval('require');
    const Redis = req('ioredis');
    const client = new Redis(url);
    return client;
  } catch {
    return null as any;
  }
}

const redisClient = getRedis();

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.expiresAt !== 'number') return null;
      if (now() > parsed.expiresAt) {
        await redisClient.del(key);
        return null;
      }
      return parsed.value as T;
    } catch {
      // fallback to memory if Redis errors
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function cacheSet(key: string, value: any, ttlSec: number): Promise<void> {
  const expiresAt = now() + ttlSec * 1000;
  if (redisClient) {
    try {
      const payload = JSON.stringify({ value, expiresAt });
      // NX not necessary; overwrite is fine
      await redisClient.set(key, payload, 'PX', ttlSec * 1000);
      return;
    } catch {
      // fall back to memory on error
    }
  }
  memoryStore.set(key, { value, expiresAt });
}

export async function cacheDel(key: string): Promise<void> {
  if (redisClient) {
    try { await redisClient.del(key); } catch {}
  }
  memoryStore.delete(key);
}
