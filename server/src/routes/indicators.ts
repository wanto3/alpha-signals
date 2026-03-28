import { Router } from 'express';
import { fetchCandles, SUPPORTED_INTERVALS } from '../services/binance.js';
import { computeIndicators } from '../services/indicators.js';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';
import { db } from '../db/database.js';

const router = Router();

router.use(rateLimit(DEFAULT_RATE_LIMIT));

// GET /api/indicators/:symbol?interval=1h&limit=200
router.get('/indicators/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const normalizedSymbol = symbol.toUpperCase().trim();
  const interval = (req.query.interval as string) || '1h';
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

  if (!SUPPORTED_INTERVALS.includes(interval)) {
    res.status(400).json({
      error: 'Invalid interval',
      supported: SUPPORTED_INTERVALS,
    });
    return;
  }

  // Check cache (5 minute TTL)
  const cacheKey = `indicators:${normalizedSymbol}:${interval}`;
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  try {
    // Fetch candles for indicator calculation
    const candles = await fetchCandles(normalizedSymbol, interval, limit);
    const indicators = computeIndicators(candles, interval);

    // Store in DB
    db.prepare(`
      INSERT OR REPLACE INTO indicators
        (symbol, interval, timestamp, rsi_14, macd_line, macd_signal, macd_histogram,
         bb_upper, bb_middle, bb_lower, sma_20, ema_12, ema_26)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      indicators.symbol, indicators.interval, indicators.timestamp,
      indicators.rsi_14, indicators.macd_line, indicators.macd_signal, indicators.macd_histogram,
      indicators.bb_upper, indicators.bb_middle, indicators.bb_lower,
      indicators.sma_20, indicators.ema_12, indicators.ema_26
    );

    set(cacheKey, indicators, 300);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: indicators });
  } catch (err) {
    const error = err as Error;
    // Try to return last known indicators from DB on API failure
    const dbIndicators = db.prepare(
      'SELECT * FROM indicators WHERE symbol = ? AND interval = ? ORDER BY timestamp DESC LIMIT 1'
    ).get(normalizedSymbol, interval) as Record<string, unknown> | undefined;

    if (dbIndicators) {
      res.setHeader('X-Cache', 'STALE');
      res.json({ data: dbIndicators, stale: true });
      return;
    }
    res.status(502).json({ error: 'Failed to compute indicators', details: error.message });
  }
});

// GET /api/indicators/:symbol/history — historical indicator values
router.get('/indicators/:symbol/history', async (req, res) => {
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

  try {
    const rows = db.prepare(
      'SELECT * FROM indicators WHERE symbol = ? AND interval = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(normalizedSymbol, interval, limit);

    res.json({ data: rows });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: 'Failed to fetch indicator history', details: error.message });
  }
});

export default router;
