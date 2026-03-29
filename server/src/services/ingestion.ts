import { db, recordFreshness } from '../db/database.js';
import { fetchAllTickers, fetchCandles } from './binance.js';
import { fetchAllTickers as coinbaseFetchAllTickers, fetchCandles as coinbaseFetchCandles, toBinanceFormat } from './coinbase.js';
import { computeIndicators, computeIndicatorsRolling } from './indicators.js';
import { set as cacheSet } from '../middleware/cache.js';

const TRACKED_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'LINK', 'ADA', 'ARB',
  'MATIC', 'AVAX', 'DOT', 'UNI', 'OP', 'NEAR', 'INJ', 'TIA', 'SEI',
];

const INTERVALS = ['1h', '4h', '1d'];

/**
 * Background data ingestion: fetches prices and candles from Binance + Coinbase fallback,
 * computes indicators, and stores everything in the SQLite database.
 */
export async function ingestPrices(): Promise<void> {
  console.log(`[ingestion] Starting price ingestion for ${TRACKED_SYMBOLS.length} symbols...`);
  let source = 'binance';
  try {
    // Try Binance first, fallback to Coinbase
    let tickers = await fetchAllTickers(TRACKED_SYMBOLS);
    if (tickers.length === 0) {
      console.log('[ingestion] Binance returned no data, trying Coinbase...');
      source = 'coinbase';
      tickers = await coinbaseFetchAllTickers(TRACKED_SYMBOLS) as unknown as typeof tickers;
    }

    const insert = db.prepare(
      'INSERT INTO prices (asset_id, price, volume_24h, change_24h, recorded_at) VALUES (?, ?, ?, ?, ?)'
    );

    const upsertAsset = db.transaction(() => {
      for (const ticker of tickers) {
        // Get asset_id from assets table
        const asset = db.prepare('SELECT id FROM assets WHERE symbol = ?').get(ticker.symbol) as { id: number } | undefined;
        if (asset) {
          insert.run(asset.id, ticker.price, ticker.volume24h, ticker.priceChangePercent, new Date().toISOString());
        }
        // Update the cache for the live price endpoint
        cacheSet(`price:${ticker.symbol}`, ticker, 30);
      }
    });
    upsertAsset();

    // Record freshness for each symbol
    for (const ticker of tickers) {
      recordFreshness('prices', ticker.symbol, 'ticker', source, 1);
    }

    console.log(`[ingestion] Ingested ${tickers.length} prices`);
  } catch (err) {
    console.error('[ingestion] Price ingestion failed:', err);
    recordFreshness('prices', 'ALL', 'ticker', source, 0, String(err));
  }
}

export async function ingestCandles(): Promise<void> {
  console.log(`[ingestion] Starting candle ingestion for ${TRACKED_SYMBOLS.length} symbols across ${INTERVALS.length} intervals...`);
  try {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO candles
        (symbol, interval, open_time, close_time, open, high, low, close, volume, quote_volume, is_closed, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const symbol of TRACKED_SYMBOLS) {
      for (const interval of INTERVALS) {
        try {
          // Try Binance first, fall back to Coinbase
          let candles = await fetchCandles(symbol, interval, 200);

          // If Binance returns empty results, try Coinbase as fallback
          if (!candles || candles.length === 0) {
            console.log(`[ingestion] Binance returned no candles for ${symbol} ${interval}, trying Coinbase...`);
            const cbCandles = await coinbaseFetchCandles(symbol, interval, 200);
            candles = toBinanceFormat(cbCandles);
          }

          const upsert = db.transaction(() => {
            for (const c of candles) {
              insert.run(
                c.symbol, c.interval, c.openTime, c.closeTime,
                c.open, c.high, c.low, c.close, c.volume, c.quoteVolume,
                c.isClosed ? 1 : 0, c.timestamp
              );
            }
          });
          upsert();

          // Record successful freshness
          const candleSource = (candles.length > 0 && 'source' in candles[0]) ? 'coinbase' : 'binance';
          recordFreshness('candles', symbol, interval, candleSource, candles.length);

          // Compute and store indicators
          const indicators = computeIndicators(candles, interval);
          db.prepare(`
            INSERT OR REPLACE INTO indicators
              (symbol, interval, timestamp, rsi_14, macd_line, macd_signal, macd_histogram,
               bb_upper, bb_middle, bb_lower, sma_20, ema_12, ema_26, stoch_k, stoch_d, atr_14, vwap)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            indicators.symbol, indicators.interval, indicators.timestamp,
            indicators.rsi_14, indicators.macd_line, indicators.macd_signal, indicators.macd_histogram,
            indicators.bb_upper, indicators.bb_middle, indicators.bb_lower,
            indicators.sma_20, indicators.ema_12, indicators.ema_26,
            indicators.stoch_k, indicators.stoch_d, indicators.atr_14, indicators.vwap
          );

          // Compute and store historical indicator snapshots for trend analysis
          const snapshots = computeIndicatorsRolling(candles, interval);
          if (snapshots.length > 0) {
            const insertSnapshot = db.prepare(`
              INSERT OR REPLACE INTO indicator_snapshots
                (symbol, interval, candle_time, timestamp, rsi_14, macd_line, macd_signal, macd_histogram,
                 bb_upper, bb_middle, bb_lower, sma_20, ema_12, ema_26, stoch_k, stoch_d, atr_14, vwap, source)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertSnapshots = db.transaction(() => {
              for (const snap of snapshots) {
                // candle_time is attached by computeIndicatorsRolling
                const snapAny = snap as unknown as { symbol: string; interval: string; candle_time: number; timestamp: number; rsi_14: number | null; macd_line: number | null; macd_signal: number | null; macd_histogram: number | null; bb_upper: number | null; bb_middle: number | null; bb_lower: number | null; sma_20: number | null; ema_12: number | null; ema_26: number | null; stoch_k: number | null; stoch_d: number | null; atr_14: number | null; vwap: number | null };
                insertSnapshot.run(
                  snapAny.symbol, snapAny.interval, snapAny.candle_time, snapAny.timestamp,
                  snapAny.rsi_14, snapAny.macd_line, snapAny.macd_signal, snapAny.macd_histogram,
                  snapAny.bb_upper, snapAny.bb_middle, snapAny.bb_lower,
                  snapAny.sma_20, snapAny.ema_12, snapAny.ema_26,
                  snapAny.stoch_k, snapAny.stoch_d, snapAny.atr_14, snapAny.vwap,
                  'computed'
                );
              }
            });
            insertSnapshots();
            console.log(`[ingestion] ${symbol} ${interval}: stored ${snapshots.length} indicator snapshots`);
          }

          // Update cache
          cacheSet(`candles:${symbol}:${interval}:200`, candles, 300);
          cacheSet(`indicators:${symbol}:${interval}`, indicators, 300);

          console.log(`[ingestion] ${symbol} ${interval}: ${candles.length} candles stored`);
        } catch (err) {
          console.error(`[ingestion] Failed to ingest ${symbol} ${interval}:`, err);
          recordFreshness('candles', symbol, interval, 'binance', 0, String(err));
        }
      }
    }
    console.log('[ingestion] Candle ingestion complete');
  } catch (err) {
    console.error('[ingestion] Candle ingestion failed:', err);
  }
}

/**
 * Initialize and start the background ingestion scheduler.
 * @param intervalMs How often to refresh prices (default: every 60 seconds)
 * @param candleIntervalMs How often to refresh candles+indicators (default: every 5 minutes)
 */
export function startIngestionScheduler(
  intervalMs = 60_000,
  candleIntervalMs = 300_000
): void {
  console.log(`[scheduler] Starting data ingestion scheduler (prices: ${intervalMs / 1000}s, candles: ${candleIntervalMs / 1000}s)`);

  // Initial ingestion
  ingestPrices().catch(console.error);
  ingestCandles().catch(console.error);

  // Periodic price updates
  setInterval(() => {
    ingestPrices().catch(console.error);
  }, intervalMs);

  // Periodic candle + indicator updates
  setInterval(() => {
    ingestCandles().catch(console.error);
  }, candleIntervalMs);
}
