import type { VercelRequest, VercelResponse } from '@vercel/node';

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
