const BASE = 'https://api.coingecko.com/api/v3';
const cache = new Map<string, { data: unknown; expiry: number }>();

async function fetchWithCache<T>(url: string, cacheMs = 300000): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiry > now) return cached.data as T;

  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  const data = await res.json() as T;
  cache.set(url, { data, expiry: now + cacheMs });
  return data;
}

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
  total_volume: number;
}

export interface OhlcData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface GlobalData {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

export function getMarketCoins(page = 1, perPage = 20) {
  return fetchWithCache<CoinMarket[]>(
    `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`
  );
}

export function searchCoins(query: string) {
  return fetchWithCache<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }> }>(
    `/search?query=${encodeURIComponent(query)}`, 60000
  );
}

export function getOhlc(coinId: string, days = 7) {
  return fetchWithCache<OhlcData[]>(
    `/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`, 300000
  );
}

export function getGlobalData() {
  return fetchWithCache<GlobalData>(`/global`, 300000);
}

export interface ChartPoint {
  time: number;
  value: number;
}

export function getMarketChart(coinId: string, days = 365) {
  return fetchWithCache<{ prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] }>(
    `/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`, 300000
  );
}
