import { useEffect, useState } from 'react';

export interface MvrvData {
  ratio: number;
  ratioChange7d: number;
  zScore: number;
  zone: 'undervalued' | 'neutral' | 'elevated' | 'extreme';
  zoneLabel: string;
  signal: 'buy' | 'hold' | 'sell';
  signalLabel: string;
  signalReason: string;
  btcPrice: number;
  marketCap: number;
  realizedCap: number;
  timestamp: number;
  history: Array<{ date: string; mvrv: number }>;
}

export function useMvrv() {
  const [data, setData] = useState<MvrvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/mvrv', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: MvrvData };

        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch MVRV data');
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
