import { Router } from 'express';
import { fetchTicker, fetchAllTickers } from '../services/binance.js';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';
import { db } from '../db/database.js';

const router = Router();

router.use(rateLimit(DEFAULT_RATE_LIMIT));

// GET /api/prices/:symbol — latest price
router.get('/prices/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Check cache (30 second TTL for live prices)
  const cacheKey = `price:${normalizedSymbol}`;
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  const asset = db.prepare('SELECT id FROM assets WHERE symbol = ?').get(normalizedSymbol) as { id: number } | undefined;

  try {
    const ticker = await fetchTicker(normalizedSymbol);

    // Store in DB
    if (asset) {
      db.prepare(
        'INSERT INTO prices (asset_id, price, volume_24h, change_24h, recorded_at) VALUES (?, ?, ?, ?, ?)'
      ).run(asset.id, ticker.price, ticker.volume24h, ticker.priceChangePercent, new Date().toISOString());
    }

    set(cacheKey, ticker, 30);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: ticker });
  } catch (err) {
    const error = err as Error;
    // Try to return last known price from DB on API failure
    if (asset) {
      const lastPrice = db.prepare(
        'SELECT price, recorded_at FROM prices WHERE asset_id = ? ORDER BY recorded_at DESC LIMIT 1'
      ).get(asset.id) as { price: number; recorded_at: string } | undefined;
      if (lastPrice) {
        res.setHeader('X-Cache', 'STALE');
        res.json({
          data: {
            symbol: normalizedSymbol,
            price: lastPrice.price,
            timestamp: new Date(lastPrice.recorded_at).getTime(),
            stale: true,
          }
        });
        return;
      }
    }
    res.status(502).json({ error: 'Failed to fetch price', details: error.message });
  }
});

// GET /api/prices — all tracked asset prices
router.get('/prices', async (_req, res) => {
  const cacheKey = 'prices:all';
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  try {
    const assets = db.prepare('SELECT symbol FROM assets').all() as { symbol: string }[];
    const symbols = assets.map(a => a.symbol);

    if (symbols.length === 0) {
      res.json({ data: [] });
      return;
    }

    const tickers = await fetchAllTickers(symbols);
    set(cacheKey, tickers, 30);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: tickers });
  } catch (err) {
    const error = err as Error;
    res.status(502).json({ error: 'Failed to fetch prices', details: error.message });
  }
});

export default router;
