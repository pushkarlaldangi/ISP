/**
 * Tiered cache: Upstash Redis primary, in-memory LRU fallback.
 *
 * We use Redis to share warm reads across serverless invocations (every
 * Vercel function spin-up otherwise starts cold). The LRU is the safety
 * net for local dev without Upstash credentials, and for the edge case
 * where Upstash quota / network glitches; in those cases we degrade
 * gracefully to per-instance memory instead of failing the request.
 *
 * Values are JSON-serialized. Dates round-trip via a `revive` parameter on
 * the read path — callers that store Date values pass a reviver so the
 * shape matches what they stored.
 */

import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

const memory = new LRUCache<string, string>({
  max: 5000,
  ttl: 90_000, // 90s — slightly longer than our 60s quote TTL so we never serve fresher-than-redis from memory only by accident.
});

let cachedRedis: Redis | null = null;
function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

export interface CacheGetResult<T> {
  value: T;
  source: 'redis' | 'memory';
}

export async function cacheGet<T>(
  key: string,
  revive?: (raw: T) => T,
): Promise<CacheGetResult<T> | null> {
  const redis = getRedis();
  if (redis) {
    try {
      // Upstash already JSON-decodes when the value was stored via `set` with a JS object.
      const raw = (await redis.get<T>(key)) ?? null;
      if (raw !== null) {
        const value = revive ? revive(raw) : raw;
        return { value, source: 'redis' };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cache] redis get failed, falling back to memory:', err);
    }
  }
  const mem = memory.get(key);
  if (mem === undefined) return null;
  try {
    const parsed = JSON.parse(mem) as T;
    const value = revive ? revive(parsed) : parsed;
    return { value, source: 'memory' };
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);
  memory.set(key, serialized, { ttl: ttlSeconds * 1000 });
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[cache] redis set failed:', err);
    }
  }
}
