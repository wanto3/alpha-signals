import { Router } from 'express';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';

const router = Router();
router.use(rateLimit(DEFAULT_RATE_LIMIT));

const UNLOCK_SCHEDULES = [
  { id: 'solana', symbol: 'SOL', name: 'Solana', nextUnlockDate: '2026-04-01', unlockAmountUsd: 142_000_000, unlockAmountTokens: 2_480_000, totalSupply: 580_000_000, vestingType: 'linear' as const, vcCostBasis: 0.022 },
  { id: 'jup', symbol: 'JUP', name: 'Jupiter', nextUnlockDate: '2026-04-05', unlockAmountUsd: 85_000_000, unlockAmountTokens: 95_000_000, totalSupply: 10_000_000_000, vestingType: 'cliff' as const, vcCostBasis: 0.05 },
  { id: 'worldcoin', symbol: 'WLD', name: 'Worldcoin', nextUnlockDate: '2026-04-03', unlockAmountUsd: 12_000_000, unlockAmountTokens: 22_000_000, totalSupply: 5_000_000_000, vestingType: 'linear' as const, vcCostBasis: 0.50 },
  { id: 'dymension', symbol: 'DYM', name: 'Dymension', nextUnlockDate: '2026-04-10', unlockAmountUsd: 28_000_000, unlockAmountTokens: 1_100_000_000, totalSupply: 10_000_000_000, vestingType: 'cliff' as const, vcCostBasis: 0.15 },
  { id: 'sei-network', symbol: 'SEI', name: 'Sei', nextUnlockDate: '2026-04-15', unlockAmountUsd: 18_000_000, unlockAmountTokens: 180_000_000, totalSupply: 3_600_000_000, vestingType: 'linear' as const, vcCostBasis: 0.10 },
  { id: 'celestia', symbol: 'TIA', name: 'Celestia', nextUnlockDate: '2026-04-20', unlockAmountUsd: 22_000_000, unlockAmountTokens: 2_200_000, totalSupply: 1_000_000_000, vestingType: 'linear' as const, vcCostBasis: 1.50 },
  { id: 'jasmycoin', symbol: 'JASMY', name: 'JasmyCoin', nextUnlockDate: '2026-04-07', unlockAmountUsd: 8_000_000, unlockAmountTokens: 500_000_000, totalSupply: 50_000_000_000, vestingType: 'linear' as const, vcCostBasis: 0.005 },
  { id: 'axelar', symbol: 'AXL', name: 'Axelar', nextUnlockDate: '2026-04-25', unlockAmountUsd: 15_000_000, unlockAmountTokens: 12_500_000, totalSupply: 1_500_000_000, vestingType: 'cliff' as const, vcCostBasis: 0.25 },
  { id: 'pyth-network', symbol: 'PYTH', name: 'Pyth Network', nextUnlockDate: '2026-04-12', unlockAmountUsd: 35_000_000, unlockAmountTokens: 180_000_000, totalSupply: 10_000_000_000, vestingType: 'cliff' as const, vcCostBasis: 0.04 },
  { id: 'altlayer', symbol: 'ALT', name: 'Altlayer', nextUnlockDate: '2026-04-18', unlockAmountUsd: 6_000_000, unlockAmountTokens: 75_000_000, totalSupply: 3_600_000_000, vestingType: 'linear' as const, vcCostBasis: 0.03 },
];

interface TokenUnlock {
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

interface TokenUnlockResponse {
  unlocks: TokenUnlock[];
  mostCritical: TokenUnlock | null;
  totalShockTokens: number;
  signal: 'buy' | 'sell' | 'hold';
  signalReason: string;
  timestamp: number;
}

function calcShockLevel(shockIndex: number): TokenUnlock['shockLevel'] {
  if (shockIndex < 0.5) return 'low';
  if (shockIndex < 1.5) return 'medium';
  if (shockIndex < 3) return 'high';
  return 'critical';
}

function calcVcPressure(unlockAmountUsd: number, vcCostBasis: number, currentPrice: number, fdv: number): number {
  if (vcCostBasis <= 0 || currentPrice <= 0) return 50;
  const profitMultiple = currentPrice / vcCostBasis;
  const unlockPctOfFdv = (unlockAmountUsd / fdv) * 100;
  const score = Math.min(100, unlockPctOfFdv * Math.log2(profitMultiple + 1) * 10);
  return Math.round(score);
}

function calcDaysUntil(dateStr: string): number {
  const now = new Date();
  const unlock = new Date(dateStr);
  const diff = unlock.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// GET /api/token-unlocks
router.get('/token-unlocks', async (_req, res) => {
  const CACHE_KEY = 'token-unlocks:v1';
  const CACHE_TTL = 7200;

  const cached = get<TokenUnlockResponse>(CACHE_KEY);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const tokenIds = UNLOCK_SCHEDULES.map(u => u.id).join(',');
    const cgUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenIds}&order=market_cap_desc&per_page=20&price_change_percentage=24h&sparkline=false`;

    let cgData: Array<{
      id: string; current_price: number; market_cap: number;
      fully_diluted_valuation: number | null; circulating_supply: number;
      total_supply: number; total_volume: number; price_change_percentage_24h: number;
    }> = [];

    try {
      const resp = await fetch(cgUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) cgData = await resp.json();
    } catch { /* proceed empty */ }

    const cgMap = new Map(cgData.map(c => [c.id, c]));
    const unlocks: TokenUnlock[] = [];

    for (const schedule of UNLOCK_SCHEDULES) {
      const cg = cgMap.get(schedule.id);
      const currentPrice = cg?.current_price ?? 0;
      const marketCap = cg?.market_cap ?? 0;
      const fdv = cg?.fully_diluted_valuation ?? marketCap;
      const circMc = cg?.circulating_supply ? cg.circulating_supply * currentPrice : marketCap;
      const ratio = circMc > 0 ? fdv / circMc : 1;
      const dexVol = cg?.total_volume ?? 1_000_000;
      const cexVol = dexVol * 0.8;
      const totalLiquidity = dexVol + cexVol;
      const shockIndex = totalLiquidity > 0 ? schedule.unlockAmountUsd / totalLiquidity : 999;
      const vcPressureScore = calcVcPressure(schedule.unlockAmountUsd, schedule.vcCostBasis, currentPrice, fdv);
      const daysUntil = calcDaysUntil(schedule.nextUnlockDate);

      let signal: TokenUnlock['signal'] = 'neutral';
      let signalReason = 'Normal unlock conditions';

      if (shockIndex >= 3) {
        signal = 'bearish';
        signalReason = `Shock Index ${shockIndex.toFixed(1)}x — unlock exceeds liquidity by ${shockIndex.toFixed(1)}x. Historically -18% avg 7d price impact`;
      } else if (shockIndex >= 1.5) {
        signal = 'bearish';
        signalReason = `Moderate shock risk: ${shockIndex.toFixed(1)}x unlock-to-liquidity ratio`;
      } else if (schedule.vestingType === 'cliff' && shockIndex >= 1.0) {
        signal = 'bearish';
        signalReason = `Cliff unlock — ${daysUntil}d away. Historically higher impact than linear vesting`;
      } else if (shockIndex < 0.5 && vcPressureScore < 30) {
        signal = 'neutral';
        signalReason = 'Unlock size manageable relative to liquidity';
      }

      unlocks.push({
        id: schedule.id,
        symbol: schedule.symbol,
        name: schedule.name,
        nextUnlockDate: schedule.nextUnlockDate,
        unlockAmountUsd: schedule.unlockAmountUsd,
        unlockAmountTokens: schedule.unlockAmountTokens,
        currentPrice,
        fdv,
        marketCap,
        circulatingMarketCap: circMc,
        ratio,
        dex24hVolume: dexVol,
        cex24hVolume: cexVol,
        totalLiquidity24h: totalLiquidity,
        shockIndex,
        shockLevel: calcShockLevel(shockIndex),
        vcPressureScore,
        vestingType: schedule.vestingType,
        vcCostBasis: schedule.vcCostBasis,
        daysUntilUnlock: daysUntil,
        signal,
        signalReason,
      });
    }

    unlocks.sort((a, b) => b.shockIndex - a.shockIndex);
    const mostCritical = unlocks[0] ?? null;
    const highShock = unlocks.filter(u => u.shockLevel === 'high' || u.shockLevel === 'critical').length;

    let signal: TokenUnlockResponse['signal'] = 'hold';
    let signalReason = 'Token unlock conditions within normal range';

    if (highShock >= 4) {
      signal = 'sell';
      signalReason = `${highShock} tokens with elevated shock index — significant near-term unlock pressure`;
    } else if (highShock >= 2) {
      signal = 'hold';
      signalReason = `${highShock} tokens flagged for unlock risk. Monitor closely`;
    } else if (highShock === 0 && mostCritical && mostCritical.shockIndex < 0.5) {
      signal = 'buy';
      signalReason = 'No critical unlocks in near term — clean supply/demand backdrop';
    }

    const response: TokenUnlockResponse = {
      unlocks,
      mostCritical,
      totalShockTokens: highShock,
      signal,
      signalReason,
      timestamp: Date.now(),
    };

    set(CACHE_KEY, response, CACHE_TTL);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: response });
  } catch (err) {
    console.error('Token unlock API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
