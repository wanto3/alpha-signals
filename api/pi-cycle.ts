import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from './cache.js';

interface ComponentScore {
  name: string;
  value: number;
  score: number; // 0-100
  status: 'bullish' | 'bearish' | 'neutral';
}

interface PiCycleResponse {
  piCycleTopTriggered: boolean;
  piCycleTopCrossPrice: number | null; // price at which crossover happened
  piCycleTopEstTriggerPrice: number | null; // estimated future trigger price
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

function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcMayerMultiple(price: number, ma200: number | null): number {
  if (!ma200 || ma200 === 0) return 0;
  return price / ma200;
}

function mayerScore(mm: number): number {
  // Mayer Multiple ranges from ~0.5 (cycle bottom) to ~3+ (cycle top)
  // Score: 0 = extremely undervalued, 100 = extremely overvalued
  if (mm <= 0.5) return 5;
  if (mm >= 3.5) return 95;
  return Math.round(((mm - 0.5) / 3.0) * 100);
}

function mayerStatus(mm: number): 'bullish' | 'bearish' | 'neutral' {
  if (mm < 1) return 'bullish';
  if (mm > 2.5) return 'bearish';
  return 'neutral';
}

function mayerZone(mm: number): string {
  if (mm < 0.8) return 'Deep value zone';
  if (mm < 1.2) return 'Below average';
  if (mm < 1.5) return 'Neutral';
  if (mm < 2.0) return 'Above average';
  if (mm < 2.5) return 'Elevated';
  return 'Extreme';
}

function goldenRatioScore(price: number, ma350: number): number {
  if (!ma350 || ma350 === 0) return 50;
  const gr = 1.618;
  const ratio = price / (ma350 * gr);
  // If price is 1x the golden ratio multiplier of MA350, score is 50
  // Below = bullish, Above = bearish
  if (ratio < 0.5) return 10;
  if (ratio > 2.0) return 90;
  return Math.round(((ratio - 0.5) / 1.5) * 80 + 10);
}

function goldenRatioStatus(price: number, ma350: number): 'bullish' | 'bearish' | 'neutral' {
  const gr = 1.618;
  const ratio = price / (ma350 * gr);
  if (ratio < 0.8) return 'bullish';
  if (ratio > 1.5) return 'bearish';
  return 'neutral';
}

async function fetchBtcPrices(days: number): Promise<number[]> {
  try {
    // Fetch from CoinGecko - get daily prices for moving averages
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { prices: [number, number][] };
    return data.prices.map(([, p]) => p);
  } catch {
    return [];
  }
}

async function fetchCurrentBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currency=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return 0;
    const data = await res.json() as Record<string, { usd: number }>;
    return data.bitcoin?.usd ?? 0;
  } catch {
    return 0;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const CACHE_KEY = 'btc:pi-cycle';
  const cached = cacheGet<PiCycleResponse>(CACHE_KEY);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    // Fetch 400 days of price data for 350-day SMA + buffer
    const [prices, currentPrice] = await Promise.all([
      fetchBtcPrices(400),
      fetchCurrentBtcPrice(),
    ]);

    if (prices.length < 350) {
      res.status(502).json({ error: 'Insufficient price history' });
      return;
    }

    // Calculate Pi Cycle Top Indicator
    // Pi Cycle Top = (111-day SMA × 2) crosses above 350-day SMA
    const ma111 = calcSMA(prices, 111);
    const ma350 = calcSMA(prices, 350);

    if (!ma111 || !ma350) {
      res.status(502).json({ error: 'Could not calculate moving averages' });
      return;
    }

    const ma111_2 = ma111 * 2;
    const btcPrice = currentPrice || prices[prices.length - 1];

    // Check if Pi Cycle Top has been triggered
    // Look at the most recent crossover
    let triggered = false;
    let crossPrice: number | null = null;

    // Look back at last 30 days for crossover
    for (let i = Math.max(0, prices.length - 30); i < prices.length - 1; i++) {
      const p111_2 = (prices[i] + (prices[i] * 0)) * 0; // We'll recalculate properly
    }

    // Proper Pi Cycle check: compare 111 SMA × 2 vs 350 SMA
    // We need to recalculate SMAs at each historical point
    const recentPrices = prices.slice(-30);
    for (let i = 1; i < recentPrices.length; i++) {
      const sliceBefore = prices.slice(0, prices.length - 30 + i);
      const sliceAfter = prices.slice(0, prices.length - 30 + i + 1);

      if (sliceBefore.length < 350 || sliceAfter.length < 350) continue;

      const ma111b = calcSMA(sliceBefore, 111);
      const ma111a = calcSMA(sliceAfter, 111);
      const ma350b = calcSMA(sliceBefore, 350);
      const ma350a = calcSMA(sliceAfter, 350);

      if (!ma111b || !ma111a || !ma350b || !ma350a) continue;

      const crossed = ma111b * 2 <= ma350b && ma111a * 2 > ma350a;
      if (crossed) {
        triggered = true;
        crossPrice = prices[prices.length - 30 + i];
        break;
      }
    }

    // Estimate future trigger price
    // If not triggered, estimate when (111 SMA × 2) will cross 350 SMA
    let estTriggerPrice: number | null = null;
    if (!triggered && ma111_2 < ma350) {
      // Linear extrapolation based on current rate of change
      const recentChange = ma111_2 / ma350;
      const targetPrice = btcPrice * (ma350 / ma111_2);
      estTriggerPrice = Math.round(targetPrice);
    }

    // Calculate Composite Cycle Score components
    const ma200 = calcSMA(prices, 200);
    const mayerMultiple = calcMayerMultiple(btcPrice, ma200);
    const mayerScoreVal = mayerScore(mayerMultiple);

    const grScore = goldenRatioScore(btcPrice, ma350);
    const grStatus = goldenRatioStatus(btcPrice, ma350);

    // MVRV proxy from price vs realized cap proxy
    // Use 365-day MA as realized cap proxy
    const ma365 = calcSMA(prices, 365);
    let mvrvProxy = 1.0;
    let mvrvStatus: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let mvrvScore = 50;
    if (ma365) {
      mvrvProxy = btcPrice / ma365;
      // MVRV historical zones: <1 undervalued, 1-3.5 neutral, 3.5-7 elevated, >7 extreme
      mvrvScore = Math.min(100, Math.max(0, Math.round(((mvrvProxy - 0.5) / 8) * 100 + 10)));
      mvrvStatus = mvrvProxy < 2 ? 'bullish' : mvrvProxy > 5 ? 'bearish' : 'neutral';
    }

    // Puell Multiple proxy: current BTC price vs 365-day average / (0 ||
    // Simplified: price / MA365 adjusted
    const puellProxy = ma365 ? btcPrice / ma365 : 1;
    const puellScore = Math.min(100, Math.max(0, Math.round(((puellProxy - 0.5) / 3.0) * 100)));
    const puellStatus = puellProxy < 1 ? 'bullish' : puellProxy > 2 ? 'bearish' : 'neutral';

    // Mayer Multiple
    const mayerStatusVal = mayerStatus(mayerMultiple);

    const components: ComponentScore[] = [
      {
        name: 'MVRV',
        value: Math.round(mvrvProxy * 100) / 100,
        score: mvrvScore,
        status: mvrvStatus,
      },
      {
        name: 'Puell Multiple',
        value: Math.round(puellProxy * 100) / 100,
        score: puellScore,
        status: puellStatus,
      },
      {
        name: 'Mayer Multiple',
        value: Math.round(mayerMultiple * 100) / 100,
        score: mayerScoreVal,
        status: mayerStatusVal,
      },
      {
        name: 'Golden Ratio',
        value: Math.round((btcPrice / (ma350 * 1.618)) * 100) / 100,
        score: grScore,
        status: grStatus,
      },
    ];

    // Composite score: weighted average
    const compositeScore = Math.round(
      (mvrvScore * 0.3 + puellScore * 0.25 + mayerScoreVal * 0.25 + grScore * 0.2)
    );

    // Determine cycle phase
    let cyclePhase: PiCycleResponse['cyclePhase'] = 'mid';
    let cyclePhaseLabel = 'Mid-cycle';

    if (triggered || compositeScore > 75) {
      cyclePhase = 'peak';
      cyclePhaseLabel = 'Peak zone — historically 2-4 weeks from local top';
    } else if (compositeScore > 65) {
      cyclePhase = 'late';
      cyclePhaseLabel = 'Late cycle — approaching overheated territory';
    } else if (compositeScore < 25) {
      cyclePhase = 'early';
      cyclePhaseLabel = 'Early cycle — accumulation zone';
    }

    let compositeSignal: PiCycleResponse['compositeSignal'] = 'hold';
    let compositeSignalLabel = 'Hold';
    let compositeSignalReason = 'Composite cycle score in neutral range';

    if (compositeScore < 25) {
      compositeSignal = 'buy';
      compositeSignalLabel = 'Strong Buy';
      compositeSignalReason = 'Composite score below 25 — historically strong accumulation zone';
    } else if (compositeScore > 65) {
      compositeSignal = 'sell';
      compositeSignalLabel = 'Sell Risk';
      compositeSignalReason = 'Composite score above 65 — cycle top zone, reduce risk';
    } else if (compositeScore > 50) {
      compositeSignalLabel = 'Hold + Caution';
      compositeSignalReason = 'Composite score elevated — monitoring for top signals';
    }

    const response: PiCycleResponse = {
      piCycleTopTriggered: triggered,
      piCycleTopCrossPrice: crossPrice,
      piCycleTopEstTriggerPrice: estTriggerPrice,
      ma111,
      ma111_2,
      ma350,
      btcPrice,
      compositeScore,
      compositeSignal,
      compositeSignalLabel,
      compositeSignalReason,
      components,
      cyclePhase,
      cyclePhaseLabel,
      timestamp: Date.now(),
    };

    cacheSet(CACHE_KEY, response, 3600);
    res.json({ data: response });
  } catch (err) {
    console.error('Pi Cycle API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
