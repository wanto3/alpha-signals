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

const CRYPTO_KEYWORDS = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol', 'dogecoin', 'xrp', 'cardano', 'ada', 'fed', 'rate', 'tariff', 'sec', 'etf', 'defi', 'nft', 'sbf', 'ftx', 'binance', 'stablecoin', 'yield', 'staking', 'layer', 'ordinal', 'runes', 'halving', 'whale', 'reserve', 'spot', 'blackrock', 'fidelity', 'grayscale', 'microstrategy', 'tesla', 'mass', 'index', 'bull', 'bear', 'recession', 'inflation', 'dollar', 'yuan', 'bonds', 'treasury'];
const RELEVANCE_KEYWORDS = ['trump', 'election', 'economy', 'inflation', 'stock', 'market', 'oil', 'gold', 'finance', 'bank', 'fed', 'rate', 'tariff', 'regulatory', 'sec', 'cftc'];

function getRelevance(question: string): number {
  const q = question.toLowerCase();
  let score = 0;
  for (const k of CRYPTO_KEYWORDS) { if (q.includes(k)) score += 10; }
  for (const k of RELEVANCE_KEYWORDS) { if (q.includes(k)) score += 3; }
  return score;
}

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
        .filter(m => getRelevance(m.question) > 0)
        .sort((a, b) => {
          const dateDiff = new Date(a.end_date_iso).getTime() - new Date(b.end_date_iso).getTime();
          if (dateDiff !== 0) return dateDiff;
          return getRelevance(b.question) - getRelevance(a.question);
        })
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
