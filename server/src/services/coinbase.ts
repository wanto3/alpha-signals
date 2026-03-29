/**
 * Coinbase public API integration for price and OHLCV data.
 * Used as a secondary/resilient data source alongside Binance.
 * Free, no API key required for public endpoints.
 */

const COINBASE_BASE = 'https://api.exchange.coinbase.com';

export interface CoinbaseTicker {
  symbol: string;
  price: number;
  volume24h: number;
  priceChangePercent: number;
  timestamp: number;
  bid: number;
  ask: number;
  source: 'coinbase';
}

export interface CoinbaseCandle {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  timestamp: number;
  source: 'coinbase';
}

const INTERVAL_MAP: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400,
  '3d': 259200,
  '1w': 604800,
};

async function fetchWithRetry<T>(url: string, retries = 3, delay = 500): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AlphaSignals/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      lastError = err as Error;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError ?? new Error('Coinbase fetch failed');
}

export async function fetchTicker(symbol: string): Promise<CoinbaseTicker> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = `${COINBASE_BASE}/products/${pair}/ticker`;

  const data = await fetchWithRetry<{
    price: string;
    size: string;
    volume: string;
    bid: string;
    ask: string;
    time: string;
  }>(url);

  const price = parseFloat(data.price);
  const volume = parseFloat(data.volume);

  // Fetch 24h stats for price change
  let priceChangePercent = 0;
  try {
    const statsUrl = `${COINBASE_BASE}/products/${pair}/stats`;
    const stats = await fetchWithRetry<{
      last: string;
      open: string;
      volume: string;
    }>(statsUrl);
    const open = parseFloat(stats.open);
    if (open > 0) {
      priceChangePercent = ((price - open) / open) * 100;
    }
  } catch {
    // stats are best-effort
  }

  return {
    symbol: symbol.toUpperCase(),
    price,
    volume24h: volume,
    priceChangePercent: Math.round(priceChangePercent * 100) / 100,
    timestamp: new Date(data.time).getTime(),
    bid: parseFloat(data.bid),
    ask: parseFloat(data.ask),
    source: 'coinbase',
  };
}

export async function fetchCandles(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<CoinbaseCandle[]> {
  const pair = `${symbol.toUpperCase()}-USD`;
  const granularity = INTERVAL_MAP[interval] ?? 3600;

  const url = `${COINBASE_BASE}/products/${pair}/candles?granularity=${granularity}&limit=${limit}`;

  // Coinbase returns [timestamp, low, high, open, close, volume]
  const data = await fetchWithRetry<number[][]>(url);

  return data.map(c => ({
    symbol: symbol.toUpperCase(),
    interval,
    openTime: c[0] * 1000,
    closeTime: (Number(c[0]) + granularity) * 1000,
    open: parseFloat(String(c[3])),
    high: parseFloat(String(c[2])),
    low: parseFloat(String(c[1])),
    close: parseFloat(String(c[4])),
    volume: parseFloat(String(c[5])),
    isClosed: true,
    timestamp: Date.now(),
    source: 'coinbase',
  }));
}

export async function fetchAllTickers(symbols: string[]): Promise<CoinbaseTicker[]> {
  const results = await Promise.allSettled(symbols.map(s => fetchTicker(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<CoinbaseTicker> => r.status === 'fulfilled')
    .map(r => r.value);
}

/**
 * Convert Coinbase candles to Binance-style candle format (with quote_volume).
 * Coinbase doesn't provide quote volume, so we estimate it.
 */
export function toBinanceFormat(coinbaseCandles: CoinbaseCandle[]): {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  isClosed: boolean;
  timestamp: number;
}[] {
  return coinbaseCandles.map(c => ({
    symbol: c.symbol,
    interval: c.interval,
    openTime: c.openTime,
    closeTime: c.closeTime,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    quoteVolume: c.volume * ((c.high + c.low + c.close) / 3), // estimate: volume * avg price
    isClosed: c.isClosed,
    timestamp: c.timestamp,
  }));
}
