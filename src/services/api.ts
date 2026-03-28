const API_BASE = import.meta.env.VITE_API_URL || '';

export interface TickerData {
  symbol: string;
  price: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChangePercent: number;
  timestamp: number;
}

export interface IndicatorData {
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
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || body.details || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export async function fetchPrices(): Promise<TickerData[]> {
  return apiFetch<TickerData[]>('/prices');
}

export async function fetchIndicators(symbol: string, interval = '1h'): Promise<IndicatorData> {
  return apiFetch<IndicatorData>(`/indicators/${symbol}?interval=${interval}`);
}

export async function fetchHealth(): Promise<{ status: string; uptime: number }> {
  return apiFetch<{ status: string; uptime: number }>('/health');
}
