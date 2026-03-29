import { useEffect, useState } from 'react';

export interface TokenUnlock {
  id: string;
  symbol: string;
  name: string;
  nextUnlockDate: string;
  unlockAmountUsd: number;
  unlockAmountTokens: number;
  currentPrice: number;
  fdv: number;
  marketCap: number;
  circulatingMarketCap: number;
  ratio: number;
  dex24hVolume: number;
  cex24hVolume: number;
  totalLiquidity24h: number;
  shockIndex: number;
  shockLevel: 'low' | 'medium' | 'high' | 'critical';
  vcPressureScore: number;
  vestingType: 'cliff' | 'linear';
  vcCostBasis: number;
  daysUntilUnlock: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  signalReason: string;
}

export interface TokenUnlockData {
  unlocks: TokenUnlock[];
  mostCritical: TokenUnlock | null;
  totalShockTokens: number;
  signal: 'buy' | 'sell' | 'hold';
  signalReason: string;
  timestamp: number;
}

export function useTokenUnlocks() {
  const [data, setData] = useState<TokenUnlockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/token-unlocks', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: TokenUnlockData };

        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch unlock data');
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
