import { useState, useEffect, useCallback } from 'react';

export interface PredictionMarket {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endDate: string;
  closed: boolean;
  slug: string;
}

interface PolymarketToken {
  outcome: string;
  price: number;
  winner: boolean;
}

interface PolymarketMarket {
  question_id: string;
  question: string;
  tokens: PolymarketToken[];
  end_date_iso: string;
  closed: boolean;
  market_slug: string;
}

interface PolymarketResponse {
  data: PolymarketMarket[];
}

const POLYMARKET_API = 'https://clob.polymarket.com/markets';

export function usePredictions(refreshIntervalMs = 300000) {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`${POLYMARKET_API}?closed=false&active=true&limit=50`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PolymarketResponse = await res.json();

      const items: PredictionMarket[] = json.data
        .filter(m => !m.closed && m.tokens && m.tokens.length >= 2)
        .filter(m => {
          const hasYes = m.tokens.some(t => t.outcome.toLowerCase() === 'yes');
          const hasNo = m.tokens.some(t => t.outcome.toLowerCase() === 'no');
          return hasYes && hasNo;
        })
        .filter(m => new Date(m.end_date_iso) > new Date())
        .slice(0, 15)
        .map(m => {
          const yesToken = m.tokens.find(t => t.outcome.toLowerCase() === 'yes');
          const noToken = m.tokens.find(t => t.outcome.toLowerCase() === 'no');
          return {
            id: m.question_id,
            question: m.question,
            yesPrice: yesToken?.price ?? 0,
            noPrice: noToken?.price ?? 0,
            endDate: m.end_date_iso,
            closed: m.closed,
            slug: m.market_slug,
          };
        });

      setMarkets(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchMarkets, refreshIntervalMs]);

  return { markets, loading, error, refetch: fetchMarkets };
}
