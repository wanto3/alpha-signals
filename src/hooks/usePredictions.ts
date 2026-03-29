import { useState, useEffect, useCallback } from 'react';

export interface PredictionOutcome {
  label: string;
  price: number;
  probabilityPercent: number;
}

export interface PredictionMarket {
  id: string;
  question: string;
  summary: string;
  outcomes: PredictionOutcome[];
  volume24h: number;
  volume7d: number;
  totalVolume: number;
  liquidity: number;
  endDate: string;
  resolved: boolean;
  winner: string | null;
  categories: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'uncertain';
  sentimentScore: number;
  cryptoSignal: 'buy' | 'sell' | 'hold' | 'n/a';
  signalReason: string;
  lastUpdated: string;
}

export interface PolymarketData {
  markets: PredictionMarket[];
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  signalReason: string;
  bullishCount: number;
  bearishCount: number;
  cryptoRelevantCount: number;
  totalVolume: number;
  timestamp: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error || body.details || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export function usePredictions(refreshIntervalMs = 300000) {
  const [data, setData] = useState<PolymarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await apiFetch<PolymarketData>('/polymarket');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, refreshIntervalMs]);

  return {
    data,
    markets: data?.markets ?? [],
    overallSignal: data?.overallSignal ?? 'neutral',
    signalReason: data?.signalReason ?? '',
    bullishCount: data?.bullishCount ?? 0,
    bearishCount: data?.bearishCount ?? 0,
    cryptoRelevantCount: data?.cryptoRelevantCount ?? 0,
    loading,
    error,
    refetch: fetchData,
  };
}
