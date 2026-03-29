import type { Request, Response } from 'express';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function set<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function cacheMiddleware<T>(
  _ttlSeconds: number,
  keyFn: (req: Request) => string
): (req: Request, res: Response, next: () => void) => void {
  return (req: Request, _res: Response, next: () => void) => {
    const key = keyFn(req);
    const cached = get<T>(key);
    if (cached) {
      (req as Request & { cachedData: T }).cachedData = cached;
    }
    next();
  };
}

export function setCachedResponse<T>(req: Request, res: Response, data: T, ttlSeconds: number): void {
  const key = `${req.url}`;
  set(key, data, ttlSeconds);
  res.json(data);
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expires) store.delete(key);
  }
}, 60000);
