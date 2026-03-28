import type { VercelRequest, VercelResponse } from '@vercel/node';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const TRACKED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
}

interface TickerData {
  symbol: string;
  price: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChangePercent: number;
  timestamp: number;
}

async function fetchTicker(pair: string): Promise<TickerData | null> {
  try {
    const res = await fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${pair}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BinanceTicker;
    return {
      symbol: data.symbol.replace('USDT', ''),
      price: parseFloat(data.lastPrice),
      volume24h: parseFloat(data.volume),
      quoteVolume24h: parseFloat(data.quoteVolume),
      priceChangePercent: parseFloat(data.priceChangePercent),
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchCandles(
  pair: string,
  interval: string = '1h',
  limit: number = 200
): Promise<number[][] | null> {
  try {
    const res = await fetch(
      `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return (await res.json()) as number[][];
  } catch {
    return null;
  }
}

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
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macdLine: number; macdSignal: number; histogram: number } | null {
  if (closes.length < slow + signal) return null;

  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(ema);
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
  return {
    macdLine: lastMacd,
    macdSignal: lastSignal,
    histogram: lastMacd - lastSignal,
  };
}

function computeBB(closes: number[], period = 20): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null;
  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: sma + 2 * stdDev,
    middle: sma,
    lower: sma - 2 * stdDev,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = (req.url ?? '').split('?')[0];
  const segments = path.split('/').filter(Boolean);
  // segments: ['api', 'prices', ':symbol?']
  const isPricesRoute = segments.includes('prices');
  const symbolParam = segments[segments.length - 1];

  // GET /api/prices — all tracked prices
  if (isPricesRoute && (symbolParam === 'prices' || segments.length <= 2)) {
    const tickers = await Promise.allSettled(TRACKED_SYMBOLS.map(s => fetchTicker(s)));
    const data = tickers
      .filter((r): r is PromiseFulfilledResult<TickerData> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value!);
    res.json({ data });
    return;
  }

  // GET /api/prices/:symbol — single ticker with indicators
  const symbol = symbolParam?.toUpperCase().replace(/[^A-Z]/g, '');
  if (symbol && symbol !== 'prices') {
    const pair = `${symbol}USDT`;
    const ticker = await fetchTicker(pair);
    if (!ticker) {
      res.status(404).json({ error: 'Symbol not found' });
      return;
    }

    const interval = (req.query.interval as string) || '1h';
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    const candles = await fetchCandles(pair, interval, limit);
    const indicators: Record<string, number | null> = {
      rsi_14: null,
      macd_line: null,
      macd_signal: null,
      macd_histogram: null,
      bb_upper: null,
      bb_middle: null,
      bb_lower: null,
      sma_20: null,
      ema_12: null,
      ema_26: null,
    };

    if (candles && candles.length > 0) {
      const closes = candles.map(c => parseFloat(c[4] as unknown as string));
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
        ...ticker,
        ...indicators,
        interval: '1h',
        timestamp: Date.now(),
      },
    });
    return;
  }

  res.json({ data: [] });
}
