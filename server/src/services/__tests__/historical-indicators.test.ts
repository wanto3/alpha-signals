import { describe, it, expect } from 'vitest';
import { computeIndicators } from '../indicators.js';
import type { CandleData } from '../binance.js';

// Helper to create mock candle data
function makeCandles(closes: number[], highs?: number[], lows?: number[], volumes?: number[]): CandleData[] {
  return closes.map((close, i) => ({
    symbol: 'BTC',
    interval: '1h',
    openTime: i * 3600 * 1000,
    closeTime: (i + 1) * 3600 * 1000,
    open: i === 0 ? close : closes[i - 1],
    high: highs?.[i] ?? close * 1.002,
    low: lows?.[i] ?? close * 0.998,
    close,
    volume: volumes?.[i] ?? 1_000_000,
    quoteVolume: (volumes?.[i] ?? 1_000_000) * close,
    isClosed: true,
    timestamp: (i + 1) * 3600 * 1000,
  }));
}

describe('Historical Indicator Computation', () => {
  it('computes rolling indicators for every candle in the series', () => {
    // Create a longer series so we can check multiple RSI values
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i + Math.sin(i * 0.3) * 5);
    const candles = makeCandles(closes);

    // We should be able to compute indicators at each point where we have enough data
    const results: Array<{ index: number; timestamp: number; rsi: number | null }> = [];

    for (let i = 14; i < candles.length; i++) {
      const subset = candles.slice(0, i + 1);
      const indicators = computeIndicators(subset, '1h');
      results.push({ index: i, timestamp: indicators.timestamp, rsi: indicators.rsi_14 });
    }

    // Should have computed indicators for candles from index 14 onwards
    expect(results.length).toBe(50 - 14);
    expect(results[0].rsi).not.toBeNull();
    expect(results[results.length - 1].rsi).not.toBeNull();
  });

  it('RSI values change as new price data arrives', () => {
    // Use oscillating prices so RSI doesn't cap at 100
    const closes50 = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10 + i * 0.3);
    const closes51 = Array.from({ length: 51 }, (_, i) => 100 + Math.sin(i * 0.3) * 10 + i * 0.3);

    const candles50 = makeCandles(closes50);
    const candles51 = makeCandles(closes51);

    const rsi50 = computeIndicators(candles50, '1h');
    const rsi51 = computeIndicators(candles51, '1h');

    // Both should be valid but at different values (RSI is based on last 14 periods)
    expect(rsi50.rsi_14).not.toBeNull();
    expect(rsi51.rsi_14).not.toBeNull();
    // RSI changes as new data arrives
    // Note: it may go up OR down depending on whether the new price moved with or against trend
    expect(rsi51.rsi_14).not.toBe(rsi50.rsi_14);
  });

  it('produces valid indicator snapshots at each time point', () => {
    // MACD needs slow EMA (26) + signal (9) = 35 candles minimum for all MACD fields
    // BB needs 20 candles. Start snapshots from index 35 to have all fields non-null
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 3);
    const candles = makeCandles(closes);

    const snapshots: Array<{
      rsi: number | null;
      macd_line: number | null;
      macd_signal: number | null;
      macd_histogram: number | null;
      bb_upper: number | null;
      bb_middle: number | null;
      bb_lower: number | null;
      sma_20: number | null;
    }> = [];

    for (let i = 35; i < candles.length; i++) {
      const subset = candles.slice(0, i + 1);
      const ind = computeIndicators(subset, '1h');
      snapshots.push({
        rsi: ind.rsi_14,
        macd_line: ind.macd_line,
        macd_signal: ind.macd_signal,
        macd_histogram: ind.macd_histogram,
        bb_upper: ind.bb_upper,
        bb_middle: ind.bb_middle,
        bb_lower: ind.bb_lower,
        sma_20: ind.sma_20,
      });
    }

    // All snapshots should be valid
    for (const snap of snapshots) {
      expect(snap.rsi).not.toBeNull();
      expect(snap.macd_line).not.toBeNull();
      expect(snap.macd_signal).not.toBeNull();
      expect(snap.macd_histogram).not.toBeNull();
      expect(snap.bb_upper).not.toBeNull();
      expect(snap.bb_middle).not.toBeNull();
      expect(snap.bb_lower).not.toBeNull();
      expect(snap.sma_20).not.toBeNull();
    }
  });

  it('BB upper > middle > lower at every snapshot', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i + Math.sin(i * 0.5) * 10);
    const candles = makeCandles(closes);

    for (let i = 19; i < candles.length; i++) {
      const subset = candles.slice(0, i + 1);
      const ind = computeIndicators(subset, '1h');
      expect(ind.bb_upper!).toBeGreaterThan(ind.bb_middle!);
      expect(ind.bb_middle!).toBeGreaterThan(ind.bb_lower!);
    }
  });
});
