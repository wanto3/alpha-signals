import { Router } from 'express';
import { fetchTicker as binanceFetchTicker, fetchAllTickers as binanceFetchAllTickers } from '../services/binance.js';
import { fetchTicker as coinbaseFetchTicker, fetchAllTickers as coinbaseFetchAllTickers } from '../services/coinbase.js';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';
import { db } from '../db/database.js';

type PriceSource = 'binance' | 'coinbase';

interface TickerResult {
  symbol: string;
  price: number;
  volume24h: number;
  priceChangePercent: number;
  timestamp: number;
  source: PriceSource;
  bid?: number;
  ask?: number;
}

const router = Router();

router.use(rateLimit(DEFAULT_RATE_LIMIT));

/**
 * Fetch price with automatic failover: Binance → Coinbase → DB fallback.
 */
async function fetchPriceWithFailover(symbol: string): Promise<{ data: TickerResult; source: PriceSource; stale: boolean }> {
  // Try Binance first (primary)
  try {
    const ticker = await binanceFetchTicker(symbol);
    return { data: ticker as unknown as TickerResult, source: 'binance', stale: false };
  } catch (_err) {
    // Binance failed, try Coinbase
  }

  // Try Coinbase (secondary)
  try {
    const ticker = await coinbaseFetchTicker(symbol);
    return { data: { ...ticker, source: 'coinbase' as PriceSource }, source: 'coinbase', stale: false };
  } catch (_err) {
    // Coinbase failed too
  }

  // Both failed — return stale from DB
  return { data: { symbol: symbol.toUpperCase(), price: 0, volume24h: 0, priceChangePercent: 0, timestamp: 0, source: 'binance' as PriceSource }, source: 'binance', stale: true };
}

// GET /api/prices/:symbol — latest price
router.get('/prices/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Check cache (30 second TTL for live prices)
  const cacheKey = `price:${normalizedSymbol}`;
  const cached = get<TickerResult>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  const asset = db.prepare('SELECT id FROM assets WHERE symbol = ?').get(normalizedSymbol) as { id: number } | undefined;
  const result = await fetchPriceWithFailover(normalizedSymbol);

  if (!result.stale) {
    // Store in DB
    if (asset) {
      db.prepare(
        'INSERT INTO prices (asset_id, price, volume_24h, change_24h, recorded_at) VALUES (?, ?, ?, ?, ?)'
      ).run(asset.id, result.data.price, result.data.volume24h, result.data.priceChangePercent, new Date().toISOString());
    }
    set(cacheKey, result.data, 30);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Price-Source', result.source);
    res.json({ data: result.data });
    return;
  }

  // Both APIs failed — try DB fallback
  if (asset) {
    const lastPrice = db.prepare(
      'SELECT price, recorded_at FROM prices WHERE asset_id = ? ORDER BY recorded_at DESC LIMIT 1'
    ).get(asset.id) as { price: number; recorded_at: string } | undefined;
    if (lastPrice) {
      res.setHeader('X-Cache', 'STALE');
      res.setHeader('X-Price-Source', 'database');
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
  res.status(502).json({ error: 'Failed to fetch price from all sources' });
});

/**
 * Fetch all prices with automatic failover: Binance → Coinbase.
 */
async function fetchAllPricesWithFailover(symbols: string[]): Promise<{ tickers: TickerResult[]; source: PriceSource }> {
  // Try Binance first
  try {
    const tickers = await binanceFetchAllTickers(symbols);
    return { tickers: tickers as unknown as TickerResult[], source: 'binance' };
  } catch (_err) {
    // Binance failed, try Coinbase
  }

  try {
    const tickers = await coinbaseFetchAllTickers(symbols);
    return { tickers: tickers.map(t => ({ ...t, source: 'coinbase' as PriceSource })), source: 'coinbase' };
  } catch (_err) {
    // Coinbase failed too
  }

  return { tickers: [], source: 'binance' };
}

// GET /api/prices — all tracked asset prices
router.get('/prices', async (_req, res) => {
  const cacheKey = 'prices:all';
  const cached = get<TickerResult[]>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  const assets = db.prepare('SELECT symbol FROM assets').all() as { symbol: string }[];
  const symbols = assets.map(a => a.symbol);

  if (symbols.length === 0) {
    res.json({ data: [] });
    return;
  }

  const result = await fetchAllPricesWithFailover(symbols);
  set(cacheKey, result.tickers, 30);
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('X-Price-Source', result.source);
  res.json({ data: result.tickers });
});

export default router;
