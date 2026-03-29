import type { CandleData } from './binance.js';

export interface Indicators {
  symbol: string;
  interval: string;
  timestamp: number;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  sma_20: number | null;
  ema_12: number | null;
  ema_26: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  atr_14: number | null;
  vwap: number | null;
}

function calcSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

function calcMACD(prices: number[], fast: number = 12, slow: number = 26, signal: number = 9): {
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
} {
  if (prices.length < slow) {
    return { macd_line: null, macd_signal: null, macd_histogram: null };
  }
  const k_fast = 2 / (fast + 1);
  const k_slow = 2 / (slow + 1);
  const k_signal = 2 / (signal + 1);

  // Calculate EMAs
  let ema_fast = prices.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
  let ema_slow = prices.slice(0, slow).reduce((a, b) => a + b, 0) / slow;
  const macdLine: number[] = [];

  for (let i = fast; i < prices.length; i++) {
    ema_fast = prices[i] * k_fast + ema_fast * (1 - k_fast);
    ema_slow = prices[i] * k_slow + ema_slow * (1 - k_slow);
    macdLine.push(ema_fast - ema_slow);
  }

  if (macdLine.length < signal) {
    return { macd_line: null, macd_signal: null, macd_histogram: null };
  }

  const macd_line = macdLine[macdLine.length - 1];
  let ema_signal = macdLine.slice(0, signal).reduce((a, b) => a + b, 0) / signal;
  for (let i = signal; i < macdLine.length; i++) {
    ema_signal = macdLine[i] * k_signal + ema_signal * (1 - k_signal);
  }
  const macd_histogram = macd_line - ema_signal;

  return {
    macd_line: Math.round(macd_line * 100) / 100,
    macd_signal: Math.round(ema_signal * 100) / 100,
    macd_histogram: Math.round(macd_histogram * 100) / 100,
  };
}

function calcBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
} {
  if (prices.length < period) {
    return { bb_upper: null, bb_middle: null, bb_lower: null };
  }
  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  return {
    bb_upper: Math.round((sma + stdDev * std) * 100) / 100,
    bb_middle: Math.round(sma * 100) / 100,
    bb_lower: Math.round((sma - stdDev * std) * 100) / 100,
  };
}

function calcStochastic(candles: CandleData[], period: number = 14): { k: number | null; d: number | null } {
  if (candles.length < period) {
    return { k: null, d: null };
  }
  const slice = candles.slice(-period);
  const high = Math.max(...slice.map(c => c.high));
  const low = Math.min(...slice.map(c => c.low));
  const close = slice[slice.length - 1].close;

  if (high === low) {
    return { k: 50, d: null };
  }
  const k = ((close - low) / (high - low)) * 100;
  // D is SMA of K over 3 periods
  if (candles.length < period + 2) {
    return { k: Math.round(k * 100) / 100, d: null };
  }
  // Calculate %K values for the last 3 bars
  const kValues: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const h = Math.max(...window.map(c => c.high));
    const l = Math.min(...window.map(c => c.low));
    const cVal = candles[i].close;
    kValues.push(h === l ? 50 : ((cVal - l) / (h - l)) * 100);
  }
  const d = kValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
  };
}

function calcATR(candles: CandleData[], period: number = 14): number | null {
  if (candles.length < period + 1) {
    return null;
  }
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  if (trueRanges.length < period) return null;
  // Use Wilder's smoothing method (same as TradingView)
  const recentTRs = trueRanges.slice(-period);
  let atr = recentTRs.reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return Math.round(atr * 100) / 100;
}

function calcVWAP(candles: CandleData[]): number | null {
  if (candles.length === 0) return null;
  let cumVP = 0;
  let cumV = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const volume = c.volume;
    cumVP += typicalPrice * volume;
    cumV += volume;
  }
  if (cumV === 0) return null;
  return Math.round((cumVP / cumV) * 100) / 100;
}

export function computeIndicators(candles: CandleData[], interval: string): Indicators {
  const closes = candles.map(c => c.close);
  const symbol = candles[0]?.symbol ?? '';
  const timestamp = candles[candles.length - 1]?.closeTime ?? Date.now();

  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes);
  const bb = calcBollingerBands(closes, 20, 2);
  const sma = calcSMA(closes, 20);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const stoch = calcStochastic(candles, 14);
  const atr = calcATR(candles, 14);
  const vwap = calcVWAP(candles);

  return {
    symbol,
    interval,
    timestamp,
    rsi_14: rsi,
    macd_line: macd.macd_line,
    macd_signal: macd.macd_signal,
    macd_histogram: macd.macd_histogram,
    bb_upper: bb.bb_upper,
    bb_middle: bb.bb_middle,
    bb_lower: bb.bb_lower,
    sma_20: sma,
    ema_12: ema12,
    ema_26: ema26,
    stoch_k: stoch.k,
    stoch_d: stoch.d,
    atr_14: atr,
    vwap,
  };
}

export function computeIndicatorsFromPrices(prices: number[], symbol: string, interval: string): Indicators {
  const rsi = calcRSI(prices, 14);
  const macd = calcMACD(prices);
  const bb = calcBollingerBands(prices, 20, 2);
  const sma = calcSMA(prices, 20);
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);

  return {
    symbol,
    interval,
    timestamp: Date.now(),
    rsi_14: rsi,
    macd_line: macd.macd_line,
    macd_signal: macd.macd_signal,
    macd_histogram: macd.macd_histogram,
    bb_upper: bb.bb_upper,
    bb_middle: bb.bb_middle,
    bb_lower: bb.bb_lower,
    sma_20: sma,
    ema_12: ema12,
    ema_26: ema26,
    stoch_k: null, // requires high/low/volume — use computeIndicators with candles
    stoch_d: null,
    atr_14: null,
    vwap: null,
  };
}
