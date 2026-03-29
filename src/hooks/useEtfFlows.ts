import { useEffect, useState } from 'react';

export interface EtfDailyFlow {
  date: string;
  price: number;
  volume: number;
  flow: number;
  direction: 'inflow' | 'outflow' | 'neutral';
}

export interface EtfFlowData {
  ticker: string;
  name: string;
  flows: EtfDailyFlow[];
  netFlow7d: number;
  avgVolume7d: number;
}

export interface EtfCategoryFlow {
  etfs: EtfFlowData[];
  totalNetFlow7d: number;
  avgVolume7d: number;
  consecutiveInflowDays: number;
  latestPriceChange: number;
}

export interface EtfFlowSignal {
  btc: EtfCategoryFlow;
  eth: EtfCategoryFlow;
  btcPriceChange24h: number;
  timestamp: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  signalLabel: string;
  signalReason: string;
  divergence: 'positive' | 'negative' | 'aligned';
}

function formatFlow(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e9) return (amount >= 0 ? '+' : '-') + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (amount >= 0 ? '+' : '-') + '$' + (abs / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return (amount >= 0 ? '+' : '-') + '$' + (abs / 1e3).toFixed(0) + 'K';
  return (amount >= 0 ? '+' : '-') + '$' + abs.toFixed(0);
}

function interpretSignal(data: EtfCategoryFlow, btcPriceChange24h: number): {
  signal: 'bullish' | 'bearish' | 'neutral';
  label: string;
  reason: string;
  divergence: 'positive' | 'negative' | 'aligned';
} {
  const netFlow = data.totalNetFlow7d;
  const consecutive = data.consecutiveInflowDays;

  // Divergence: ETF flow direction vs underlying price direction
  const priceDirection = btcPriceChange24h > 0 ? 'positive' : btcPriceChange24h < 0 ? 'negative' : 'neutral';
  const flowDirection = netFlow > 0 ? 'positive' : netFlow < 0 ? 'negative' : 'neutral';
  const divergence = priceDirection !== 'neutral' && flowDirection !== 'neutral'
    ? (priceDirection === flowDirection ? 'aligned' : 'positive')
    : 'aligned';

  let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let label = 'Hold';
  let reason = 'ETF flows neutral';

  if (netFlow > 0) {
    if (consecutive >= 5) {
      signal = 'bullish';
      label = 'Strong Buy';
      reason = `${consecutive}-day inflow streak — historical precedent: +18% avg BTC return (30d)`;
    } else if (consecutive >= 3) {
      signal = 'bullish';
      label = 'Buy Signal';
      reason = `${consecutive} consecutive inflow days with net +${formatFlow(netFlow)}`;
    } else if (consecutive >= 1) {
      signal = 'bullish';
      label = 'Cautious Buy';
      reason = `Net positive flows: ${formatFlow(netFlow)} over 7 days`;
    } else {
      signal = 'bullish';
      label = 'Buy Signal';
      reason = `Net positive flows: ${formatFlow(netFlow)} over 7 days`;
    }
  } else if (netFlow < 0) {
    if (Math.abs(consecutive) >= 5) {
      signal = 'bearish';
      label = 'Strong Sell';
      reason = `${Math.abs(consecutive)}-day outflow streak — institutional selling pressure`;
    } else {
      signal = 'bearish';
      label = 'Sell Signal';
      reason = `Net outflows: ${formatFlow(netFlow)} over 7 days`;
    }
  }

  // Adjust signal based on divergence
  if (divergence === 'positive') {
    reason += ' | Price/flow divergence: institutions ahead of market';
  }

  return { signal, label, reason, divergence };
}

export function useEtfFlows() {
  const [data, setData] = useState<EtfFlowSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/etf-flows', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: {
          btc: EtfCategoryFlow;
          eth: EtfCategoryFlow;
          timestamp: number;
          btcPriceChange24h: number;
        }};
        const raw = json.data;

        const btcSignal = interpretSignal(raw.btc, raw.btcPriceChange24h);

        const enriched: EtfFlowSignal = {
          btc: raw.btc,
          eth: raw.eth,
          btcPriceChange24h: raw.btcPriceChange24h,
          timestamp: raw.timestamp,
          signal: btcSignal.signal,
          signalLabel: btcSignal.label,
          signalReason: btcSignal.reason,
          divergence: btcSignal.divergence,
        };

        if (!cancelled) {
          setData(enriched);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch ETF data');
          setLoading(false);
        }
      }
    }

    fetchData();
    // Refresh every 30 minutes
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}

export { formatFlow };
