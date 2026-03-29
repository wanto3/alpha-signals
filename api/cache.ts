/**
 * Shared in-memory cache for Vercel API routes.
 * Persists within a warm function instance. TTL in seconds.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

// Module-level cache — persists across requests within warm instance
const cache = new Map<string, CacheEntry<unknown>>();

// Active fetches for request deduplication (prevents thundering herd)
const inflight = new Map<string, Promise<unknown>>();

/**
 * Get cached data if still valid.
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Set cached data with TTL in seconds.
 */
export function cacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

/**
 * Deduplicate concurrent requests for the same key.
 * If a fetch is already in-flight for this key, wait for it instead of making a duplicate call.
 */
export async function dedupedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Check cache first
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  // Check if already in-flight
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Make the fetch and track it
  const promise = fetchFn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/**
 * Cache-friendly fetch wrapper.
 * Returns cached data if available, otherwise calls fetchFn and caches the result.
 */
export async function cachedFetch<T>(
  url: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<{ data: T; fromCache: boolean }> {
  const cached = cacheGet<T>(url);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  const data = await fetchFn();
  cacheSet(url, data, ttlSeconds);
  return { data, fromCache: false };
}

/**
 * Get cache hit rate for monitoring (useful for debugging).
 */
export function cacheStats(): { size: number; keys: string[] } {
  const keys: string[] = [];
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now <= entry.expires) keys.push(key);
  }
  return { size: cache.size, keys };
}
