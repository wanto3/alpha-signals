import { describe, it, expect } from 'vitest';
import { toBinanceFormat } from '../coinbase.js';
import type { CoinbaseCandle } from '../coinbase.js';

describe('Coinbase toBinanceFormat', () => {
  it('converts Coinbase candles to Binance format with quote volume estimate', () => {
    const coinbaseCandles: CoinbaseCandle[] = [
      {
        symbol: 'BTC',
        interval: '1h',
        openTime: 1000,
        closeTime: 3601000,
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000,
        isClosed: true,
        timestamp: 3601000,
        source: 'coinbase',
      },
    ];

    const result = toBinanceFormat(coinbaseCandles);

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC');
    expect(result[0].interval).toBe('1h');
    expect(result[0].openTime).toBe(1000);
    expect(result[0].closeTime).toBe(3601000);
    expect(result[0].open).toBe(50000);
    expect(result[0].high).toBe(51000);
    expect(result[0].low).toBe(49000);
    expect(result[0].close).toBe(50500);
    expect(result[0].volume).toBe(1000);
    expect(result[0].isClosed).toBe(true);
  });

  it('estimates quote volume as volume * avg price', () => {
    const coinbaseCandles: CoinbaseCandle[] = [
      {
        symbol: 'ETH',
        interval: '4h',
        openTime: 0,
        closeTime: 14400000,
        open: 3000,
        high: 3100,
        low: 2900,
        close: 3050,
        volume: 500,
        isClosed: true,
        timestamp: 14400000,
        source: 'coinbase',
      },
    ];

    const result = toBinanceFormat(coinbaseCandles);

    // avg price = (high + low + close) / 3 = (3100 + 2900 + 3050) / 3 = 3016.67
    // quote volume ≈ 500 * 3016.67 = 1,508,333.33
    const avgPrice = (3100 + 2900 + 3050) / 3;
    expect(result[0].quoteVolume).toBeCloseTo(500 * avgPrice, 0);
  });

  it('handles multiple candles', () => {
    const coinbaseCandles: CoinbaseCandle[] = [
      {
        symbol: 'SOL',
        interval: '1h',
        openTime: 0,
        closeTime: 3600000,
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 10000,
        isClosed: true,
        timestamp: 3600000,
        source: 'coinbase',
      },
      {
        symbol: 'SOL',
        interval: '1h',
        openTime: 3600000,
        closeTime: 7200000,
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 12000,
        isClosed: true,
        timestamp: 7200000,
        source: 'coinbase',
      },
    ];

    const result = toBinanceFormat(coinbaseCandles);

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('SOL');
    expect(result[1].symbol).toBe('SOL');
    expect(result[0].openTime).toBe(0);
    expect(result[1].openTime).toBe(3600000);
    expect(result[0].quoteVolume).toBeGreaterThan(0);
    expect(result[1].quoteVolume).toBeGreaterThan(0);
  });

  it('preserves timestamp and isClosed', () => {
    const coinbaseCandles: CoinbaseCandle[] = [
      {
        symbol: 'BTC',
        interval: '1d',
        openTime: 86400000,
        closeTime: 172800000,
        open: 60000,
        high: 62000,
        low: 58000,
        close: 61000,
        volume: 50000,
        isClosed: true,
        timestamp: 172800000,
        source: 'coinbase',
      },
    ];

    const result = toBinanceFormat(coinbaseCandles);

    expect(result[0].timestamp).toBe(172800000);
    expect(result[0].isClosed).toBe(true);
  });
});

describe('CoinbaseCandle interface', () => {
  it('has all required fields', () => {
    const candle: CoinbaseCandle = {
      symbol: 'DOGE',
      interval: '15m',
      openTime: 900000,
      closeTime: 1800000,
      open: 0.10,
      high: 0.11,
      low: 0.09,
      close: 0.105,
      volume: 1_000_000,
      isClosed: false,
      timestamp: 1800000,
      source: 'coinbase',
    };

    expect(candle.symbol).toBe('DOGE');
    expect(candle.interval).toBe('15m');
    expect(candle.source).toBe('coinbase');
  });
});
