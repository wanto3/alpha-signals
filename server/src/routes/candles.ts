import { Router } from 'express';
import { fetchCandles, SUPPORTED_INTERVALS } from '../services/binance.js';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';
import { db } from '../db/database.js';

const router = Router();

router.use(rateLimit(DEFAULT_RATE_LIMIT));

// GET /api/candles/:symbol?interval=1h&limit=100
router.get('/candles/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const normalizedSymbol = symbol.toUpperCase().trim();
  const interval = (req.query.interval as string) || '1h';
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  if (!SUPPORTED_INTERVALS.includes(interval)) {
    res.status(400).json({
      error: 'Invalid interval',
      supported: SUPPORTED_INTERVALS,
    });
    return;
  }

  // Check cache (5 minute TTL for candle data)
  const cacheKey = `candles:${normalizedSymbol}:${interval}:${limit}`;
  const cached = get<unknown[]>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  try {
    const candles = await fetchCandles(normalizedSymbol, interval, limit);

    // Store in DB
    const insert = db.prepare(`
      INSERT OR REPLACE INTO candles
        (symbol, interval, open_time, close_time, open, high, low, close, volume, quote_volume, is_closed, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction(() => {
      for (const c of candles) {
        insert.run(
          c.symbol, c.interval, c.openTime, c.closeTime,
          c.open, c.high, c.low, c.close, c.volume, c.quoteVolume,
          c.isClosed ? 1 : 0, c.timestamp
        );
      }
    });
    insertMany();

    set(cacheKey, candles, 300);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: candles, interval, limit });
  } catch (err) {
    const error = err as Error;
    // Try to return cached candles from DB on API failure
    const dbCandles = db.prepare(
      'SELECT * FROM candles WHERE symbol = ? AND interval = ? ORDER BY open_time DESC LIMIT ?'
    ).all(normalizedSymbol, interval, limit) as Record<string, unknown>[];

    if (dbCandles.length > 0) {
      res.setHeader('X-Cache', 'STALE');
      res.json({
        data: dbCandles.map(c => ({ ...c, isClosed: c.is_closed === 1 })),
        stale: true,
      });
      return;
    }
    res.status(502).json({ error: 'Failed to fetch candles', details: error.message });
  }
});

export default router;
