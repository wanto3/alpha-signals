import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../cache.js';

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  LINK: 'chainlink',
  ADA: 'cardano',
  ARB: 'arbitrum',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  UNI: 'uniswap',
};

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function computeMACD(closes: number[], fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const result: number[] = [ema];
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      result.push(ema);
    }
    return result;
  }
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  const macdLine: number[] = [];
  const offset = slow - fast;
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }
  const macdSignalEma = ema(macdLine, signal);
  const lastSignal = macdSignalEma[macdSignalEma.length - 1];
  const lastMacd = macdLine[macdLine.length - 1];
  return { macdLine: lastMacd, macdSignal: lastSignal, histogram: lastMacd - lastSignal };
}

function computeBB(closes: number[], period = 20) {
  if (closes.length < period) return null;
  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: sma + 2 * stdDev, middle: sma, lower: sma - 2 * stdDev };
}

function computeStochastic(candles: number[][], period = 14): { k: number | null; d: number | null } {
  // candles: [timestamp, open, high, low, close]
  if (candles.length < period) return { k: null, d: null };
  const slice = candles.slice(-period);
  const highs = slice.map(c => c[2]); // high
  const lows = slice.map(c => c[3]);  // low
  const close = slice[slice.length - 1][4];
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  if (high === low) return { k: 50, d: null };
  const k = ((close - low) / (high - low)) * 100;
  // Calculate %K values for last 3 bars to compute %D
  if (candles.length < period + 2) return { k: Math.round(k * 100) / 100, d: null };
  const kValues: number[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const h = Math.max(...window.map(c => c[2]));
    const l = Math.min(...window.map(c => c[3]));
    const cVal = candles[i][4];
    kValues.push(h === l ? 50 : ((cVal - l) / (h - l)) * 100);
  }
  const d = kValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return { k: Math.round(k * 100) / 100, d: Math.round(d * 100) / 100 };
}

function computeATR(candles: number[][], period = 14): number | null {
  // candles: [timestamp, open, high, low, close]
  if (candles.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i][2];
    const low = candles[i][3];
    const prevClose = candles[i - 1][4];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  if (trueRanges.length < period) return null;
  // Wilder's smoothing
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return Math.round(atr * 100) / 100;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(200).end();
    return;
  }

  const symbol = (req.query.symbol as string | undefined)?.toUpperCase().replace(/[^A-Z]/g, '');
  if (!symbol) {
    res.status(400).json({ error: 'Symbol is required' });
    return;
  }

  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) {
    res.status(404).json({ error: 'Unsupported symbol' });
    return;
  }

  // CoinGecko OHLC supports: 1, 7, 14, 30, 90, 180, 365 days
  // Map interval to CoinGecko days parameter
  const interval = (req.query.interval as string) || '1d';
  const daysMap: Record<string, number> = {
    '1h': 1,
    '1d': 1,
    '7d': 7,
    '14d': 14,
    '30d': 30,
  };
  const days = daysMap[interval] ?? 30;

  // Check in-memory cache first (5 minute TTL)
  const cacheKey = `indicators:${symbol}:${interval}`;
  const cached = cacheGet<Record<string, number | null>>(cacheKey);
  if (cached) {
    res.json({
      data: {
        symbol,
        interval,
        timestamp: Date.now(),
        ...cached,
        _fromCache: true,
      },
    });
    return;
  }

  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;

  let candles: number[][] = [];
  try {
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      candles = (await resp.json()) as number[][];
    }
  } catch {
    // Fall through to return empty indicators
  }

  const closes = candles.map(c => c[4]);
  const indicators: Record<string, number | null> = {
    rsi_14: null, macd_line: null, macd_signal: null, macd_histogram: null,
    bb_upper: null, bb_middle: null, bb_lower: null, sma_20: null,
    ema_12: null, ema_26: null,
    stoch_k: null, stoch_d: null, atr_14: null,
    vwap: null, // requires volume — use /api/candles endpoint with Binance for VWAP
  };

  if (closes.length > 0) {
    const rsiVal = computeRSI(closes);
    if (rsiVal !== null) indicators.rsi_14 = rsiVal;
    const macd = computeMACD(closes);
    if (macd) {
      indicators.macd_line = macd.macdLine;
      indicators.macd_signal = macd.macdSignal;
      indicators.macd_histogram = macd.histogram;
    }
    const bb = computeBB(closes);
    if (bb) {
      indicators.bb_upper = bb.upper;
      indicators.bb_middle = bb.middle;
      indicators.bb_lower = bb.lower;
    }
    if (closes.length >= 20) {
      indicators.sma_20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    }
    if (candles.length > 0) {
      const stoch = computeStochastic(candles, 14);
      indicators.stoch_k = stoch.k;
      indicators.stoch_d = stoch.d;
      const atr = computeATR(candles, 14);
      indicators.atr_14 = atr;
    }

    // Cache the computed indicators for 5 minutes
    cacheSet(cacheKey, indicators, 300);
  }

  res.json({
    data: {
      symbol,
      interval,
      timestamp: Date.now(),
      ...indicators,
    },
  });
}
