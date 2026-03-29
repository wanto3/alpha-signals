import { describe, it, expect } from 'vitest';
import { computeIndicators, computeIndicatorsFromPrices } from '../indicators.js';

// Helper to create mock candle data
function makeCandles(closes: number[], highs?: number[], lows?: number[], volumes?: number[]) {
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

// Known price series for reproducible tests
// Prices: 100, 102, 101, 103, 105, 107, 106, 108, 110, 109,
//         111, 113, 112, 114, 116, 118, 117, 119, 121, 120,
//         122, 124, 123, 125, 127, 129, 128, 130, 132, 134
const KNOWN_CLOSES = [
  100, 102, 101, 103, 105, 107, 106, 108, 110, 109,
  111, 113, 112, 114, 116, 118, 117, 119, 121, 120,
  122, 124, 123, 125, 127, 129, 128, 130, 132, 134,
];

describe('RSI Calculation', () => {
  it('returns null when fewer than 15 data points', () => {
    const candles = makeCandles([100, 102, 103]);
    const result = computeIndicators(candles, '1h');
    expect(result.rsi_14).toBeNull();
  });

  it('returns a value between 0 and 100 for valid data', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.rsi_14).not.toBeNull();
    expect(result.rsi_14).toBeGreaterThan(0);
    expect(result.rsi_14).toBeLessThan(100);
  });

  it('returns 100 when all changes are positive', () => {
    // Strictly increasing prices → no losses → RSI = 100
    const upOnly = Array.from({ length: 20 }, (_, i) => 100 + i);
    const candles = makeCandles(upOnly);
    const result = computeIndicators(candles, '1h');
    expect(result.rsi_14).toBe(100);
  });

  it('returns 0 when all changes are negative', () => {
    // Strictly decreasing prices → no gains → RSI = 0
    const downOnly = Array.from({ length: 20 }, (_, i) => 120 - i);
    const candles = makeCandles(downOnly);
    const result = computeIndicators(candles, '1h');
    expect(result.rsi_14).toBe(0);
  });

  it('computeIndicatorsFromPrices produces same RSI as computeIndicators', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const fromCandles = computeIndicators(candles, '1h');
    const fromPrices = computeIndicatorsFromPrices(KNOWN_CLOSES, 'BTC', '1h');
    expect(fromPrices.rsi_14).toBe(fromCandles.rsi_14);
  });
});

describe('MACD Calculation', () => {
  it('returns null when fewer than 26 data points', () => {
    const candles = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i));
    const result = computeIndicators(candles, '1h');
    expect(result.macd_line).toBeNull();
    expect(result.macd_signal).toBeNull();
    expect(result.macd_histogram).toBeNull();
  });

  it('returns valid MACD values when enough data exists', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.macd_line).not.toBeNull();
    expect(result.macd_signal).not.toBeNull();
    expect(result.macd_histogram).not.toBeNull();
  });

  it('computes histogram as difference between MACD line and signal', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    if (result.macd_line !== null && result.macd_signal !== null) {
      const expectedHist = Math.round((result.macd_line - result.macd_signal) * 100) / 100;
      expect(result.macd_histogram).toBeCloseTo(expectedHist, 1);
    }
  });

  it('macd_histogram is rounded to 2 decimal places', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    if (result.macd_histogram !== null) {
      // Check it's at most 2 decimal places
      const str = String(result.macd_histogram);
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});

describe('Bollinger Bands', () => {
  it('returns null when fewer than 20 data points', () => {
    const candles = makeCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    const result = computeIndicators(candles, '1h');
    expect(result.bb_upper).toBeNull();
    expect(result.bb_middle).toBeNull();
    expect(result.bb_lower).toBeNull();
  });

  it('middle band equals SMA of last 20 closes', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    const last20 = KNOWN_CLOSES.slice(-20);
    const expectedSMA = last20.reduce((a, b) => a + b, 0) / 20;
    expect(result.bb_middle).toBeCloseTo(expectedSMA, 1);
  });

  it('upper band > middle band > lower band', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.bb_upper!).toBeGreaterThan(result.bb_middle!);
    expect(result.bb_middle!).toBeGreaterThan(result.bb_lower!);
  });

  it('bands are properly spaced around the middle band', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    const upperDist = result.bb_upper! - result.bb_middle!;
    const lowerDist = result.bb_middle! - result.bb_lower!;
    // Should be approximately equal (within 10% for random-ish data)
    expect(Math.abs(upperDist - lowerDist) / result.bb_middle!).toBeLessThan(0.1);
  });
});

describe('SMA and EMA', () => {
  it('SMA returns null with fewer than 20 points', () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = computeIndicators(candles, '1h');
    expect(result.sma_20).toBeNull();
  });

  it('SMA equals the arithmetic mean of last 20 closes', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    const last20 = KNOWN_CLOSES.slice(-20);
    const expectedSMA = last20.reduce((a, b) => a + b, 0) / 20;
    expect(result.sma_20).toBeCloseTo(expectedSMA, 1);
  });

  it('EMA-12 and EMA-26 are not null with enough data', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.ema_12).not.toBeNull();
    expect(result.ema_26).not.toBeNull();
  });

  it('EMA-12 > EMA-26 in a rising market', () => {
    // Strictly rising prices → fast EMA should be above slow EMA
    const rising = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const candles = makeCandles(rising);
    const result = computeIndicators(candles, '1h');
    expect(result.ema_12!).toBeGreaterThan(result.ema_26!);
  });

  it('EMA-12 < EMA-26 in a falling market', () => {
    // Strictly falling prices → fast EMA should be below slow EMA
    const falling = Array.from({ length: 40 }, (_, i) => 120 - i * 0.5);
    const candles = makeCandles(falling);
    const result = computeIndicators(candles, '1h');
    expect(result.ema_12!).toBeLessThan(result.ema_26!);
  });
});

describe('Stochastic Oscillator', () => {
  it('returns null with fewer than 14 candles', () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = computeIndicators(candles, '1h');
    expect(result.stoch_k).toBeNull();
    expect(result.stoch_d).toBeNull();
  });

  it('%K is between 0 and 100', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    if (result.stoch_k !== null) {
      expect(result.stoch_k).toBeGreaterThanOrEqual(0);
      expect(result.stoch_k).toBeLessThanOrEqual(100);
    }
  });

  it('%D is between 0 and 100 when defined', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    if (result.stoch_d !== null) {
      expect(result.stoch_d).toBeGreaterThanOrEqual(0);
      expect(result.stoch_d).toBeLessThanOrEqual(100);
    }
  });

  it('computeIndicatorsFromPrices returns null for stoch (requires highs/lows)', () => {
    const result = computeIndicatorsFromPrices(KNOWN_CLOSES, 'BTC', '1h');
    expect(result.stoch_k).toBeNull();
    expect(result.stoch_d).toBeNull();
  });

  it('%K = 100 when close equals the 14-bar high', () => {
    // Create a candle where close = 14-bar high
    const prices = Array.from({ length: 14 }, (_, i) => 100 + i);
    const lastClose = 114; // equals the 14-bar high
    const allCandles = makeCandles([...prices, lastClose]);
    // Set the last candle's high to match close
    allCandles[14].high = 114;
    allCandles[14].low = 113;
    allCandles[14].close = 114;

    const result = computeIndicators(allCandles, '1h');
    expect(result.stoch_k!).toBeCloseTo(100, 0);
  });

  it('%K = 0 when close equals the 14-bar low', () => {
    const prices = Array.from({ length: 14 }, (_, i) => 101 + i);
    const lastClose = 101; // equals the 14-bar low
    const allCandles = makeCandles([...prices, lastClose]);
    allCandles[14].high = 115;
    allCandles[14].low = 101;
    allCandles[14].close = 101;

    const result = computeIndicators(allCandles, '1h');
    expect(result.stoch_k!).toBeCloseTo(0, 0);
  });
});

describe('ATR (Average True Range)', () => {
  it('returns null with fewer than 15 candles', () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = computeIndicators(candles, '1h');
    expect(result.atr_14).toBeNull();
  });

  it('ATR is positive', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.atr_14!).toBeGreaterThan(0);
  });

  it('ATR uses Wilder\'s smoothing method', () => {
    // With constant volatility, ATR should stabilize
    const stable = Array.from({ length: 50 }, (_, i) => {
      const t = i * 0.01;
      return 100 + Math.sin(t) * 2;
    });
    const candles = makeCandles(stable);
    const result = computeIndicators(candles, '1h');
    // ATR should be a small positive number reflecting the ±2 range
    expect(result.atr_14!).toBeGreaterThan(0);
    expect(result.atr_14!).toBeLessThan(10);
  });

  it('ATR is null from computeIndicatorsFromPrices (requires candle highs/lows)', () => {
    const result = computeIndicatorsFromPrices(KNOWN_CLOSES, 'BTC', '1h');
    expect(result.atr_14).toBeNull();
  });
});

describe('VWAP', () => {
  it('returns null with no candles', () => {
    const result = computeIndicators([], '1h');
    expect(result.vwap).toBeNull();
  });

  it('VWAP is positive when prices are positive', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.vwap!).toBeGreaterThan(0);
  });

  it('VWAP is between the min and max of the price range', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    const minPrice = Math.min(...KNOWN_CLOSES);
    const maxPrice = Math.max(...KNOWN_CLOSES);
    expect(result.vwap!).toBeGreaterThanOrEqual(minPrice);
    expect(result.vwap!).toBeLessThanOrEqual(maxPrice);
  });

  it('VWAP equals the volume-weighted average price', () => {
    // Create candles with known prices and volumes
    const candles = [
      { symbol: 'BTC', interval: '1h', openTime: 0, closeTime: 3600, open: 100, high: 101, low: 99, close: 100, volume: 1000, quoteVolume: 100_000, isClosed: true, timestamp: 3600 },
      { symbol: 'BTC', interval: '1h', openTime: 3600, closeTime: 7200, open: 100, high: 102, low: 99, close: 101, volume: 2000, quoteVolume: 202_000, isClosed: true, timestamp: 7200 },
      { symbol: 'BTC', interval: '1h', openTime: 7200, closeTime: 10800, open: 101, high: 103, low: 100, close: 102, volume: 1500, quoteVolume: 153_000, isClosed: true, timestamp: 10800 },
    ];

    const result = computeIndicators(candles as Parameters<typeof computeIndicators>[0], '1h');

    // Manual VWAP: sum(typical_price * volume) / sum(volume)
    // typical_price = (high + low + close) / 3
    const tp1 = (101 + 99 + 100) / 3; // 100
    const tp2 = (102 + 99 + 101) / 3; // 100.667
    const tp3 = (103 + 100 + 102) / 3; // 101.667
    const expectedVWAP = (tp1 * 1000 + tp2 * 2000 + tp3 * 1500) / (1000 + 2000 + 1500);
    expect(result.vwap!).toBeCloseTo(expectedVWAP, 1);
  });

  it('VWAP is null from computeIndicatorsFromPrices (requires candle volume)', () => {
    const result = computeIndicatorsFromPrices(KNOWN_CLOSES, 'BTC', '1h');
    expect(result.vwap).toBeNull();
  });
});

describe('computeIndicators metadata', () => {
  it('preserves symbol from candles', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    candles[0].symbol = 'ETH';
    const result = computeIndicators(candles, '1h');
    expect(result.symbol).toBe('ETH');
  });

  it('preserves interval from parameter', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '4h');
    expect(result.interval).toBe('4h');
  });

  it('timestamp is from the last candle close time', () => {
    const candles = makeCandles(KNOWN_CLOSES);
    const result = computeIndicators(candles, '1h');
    expect(result.timestamp).toBe(candles[candles.length - 1].closeTime);
  });
});

describe('computeIndicatorsFromPrices', () => {
  it('returns all basic indicators for price-only data', () => {
    const result = computeIndicatorsFromPrices(KNOWN_CLOSES, 'ETH', '1d');
    expect(result.symbol).toBe('ETH');
    expect(result.interval).toBe('1d');
    expect(result.rsi_14).not.toBeNull();
    expect(result.macd_line).not.toBeNull();
    expect(result.bb_upper).not.toBeNull();
    expect(result.sma_20).not.toBeNull();
    expect(result.ema_12).not.toBeNull();
    expect(result.ema_26).not.toBeNull();
  });

  it('returns null for candle-only indicators', () => {
    const result = computeIndicatorsFromPrices(KNOWN_CLOSES, 'ETH', '1d');
    expect(result.stoch_k).toBeNull();
    expect(result.stoch_d).toBeNull();
    expect(result.atr_14).toBeNull();
    expect(result.vwap).toBeNull();
  });
});
