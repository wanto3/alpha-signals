import { useEffect, useState } from 'react';

export interface FdvToken {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  fdv: number;
  circulatingMarketCap: number;
  ratio: number;
  hiddenSellPressure: number;
  priceChange24h: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  rank: number;
}

export interface FdvRatioData {
  tokens: FdvToken[];
  signal: 'buy' | 'sell' | 'hold';
  signalReason: string;
  highRiskCount: number;
  timestamp: number;
}

export function useFdvRatio() {
  const [data, setData] = useState<FdvRatioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/fdv-ratio', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: FdvRatioData };

        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch FDV data');
          setLoading(false);
        }
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000); // Refresh hourly
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}
