import { useEffect, useState } from 'react';

export interface ComponentScore {
  name: string;
  value: number;
  score: number; // 0-100
  status: 'bullish' | 'bearish' | 'neutral';
}

export interface PiCycleData {
  piCycleTopTriggered: boolean;
  piCycleTopCrossPrice: number | null;
  piCycleTopEstTriggerPrice: number | null;
  ma111: number;
  ma111_2: number;
  ma350: number;
  btcPrice: number;
  compositeScore: number; // 0-100
  compositeSignal: 'buy' | 'hold' | 'sell';
  compositeSignalLabel: string;
  compositeSignalReason: string;
  components: ComponentScore[];
  cyclePhase: 'early' | 'mid' | 'late' | 'peak';
  cyclePhaseLabel: string;
  timestamp: number;
}

export function usePiCycle() {
  const [data, setData] = useState<PiCycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/pi-cycle', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { data: PiCycleData };

        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Pi Cycle data');
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
