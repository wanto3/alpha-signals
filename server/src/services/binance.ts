const BINANCE_BASE = process.env.BINANCE_API_URL || 'https://testnet.binance.vision/api/v3';

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  priceChangePercent: string;
}

interface BinanceCandle {
  0: number;  // open time
  1: string;  // open
  2: string;  // high
  3: string;  // low
  4: string;  // close
  5: string;  // volume
  6: number;  // close time
  7: string;  // quote volume
  8: number;  // num trades
  9: string;  // taker buy base
  10: string; // taker buy quote
}

export interface TickerData {
  symbol: string;
  price: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChangePercent: number;
  timestamp: number;
}

export interface CandleData {
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
}

async function fetchWithRetry<T>(url: string, retries = 3, delay = 500): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
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
  throw lastError ?? new Error('Fetch failed');
}

export async function fetchTicker(symbol: string): Promise<TickerData> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = `${BINANCE_BASE}/ticker/24hr?symbol=${pair}`;
  const data = await fetchWithRetry<BinanceTicker>(url);
  return {
    symbol: symbol.toUpperCase(),
    price: parseFloat(data.lastPrice),
    volume24h: parseFloat(data.volume),
    quoteVolume24h: parseFloat(data.quoteVolume),
    priceChangePercent: parseFloat(data.priceChangePercent),
    timestamp: Date.now(),
  };
}

export async function fetchCandles(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<CandleData[]> {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data = await fetchWithRetry<BinanceCandle[]>(url);
  return data.map(c => ({
    symbol: symbol.toUpperCase(),
    interval,
    openTime: c[0],
    closeTime: c[6],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
    quoteVolume: parseFloat(c[7]),
    isClosed: true,
    timestamp: Date.now(),
  }));
}

export async function fetchAllTickers(symbols: string[]): Promise<TickerData[]> {
  const results = await Promise.allSettled(symbols.map(s => fetchTicker(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<TickerData> => r.status === 'fulfilled')
    .map(r => r.value);
}

export const SUPPORTED_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
