import { Router } from 'express';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';

const router = Router();
router.use(rateLimit(DEFAULT_RATE_LIMIT));

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'crypto',
  'defi', 'polkadot', 'cardano', 'ada', 'ripple', 'xrp',
  'binance', 'coinbase', 'exchange', 'stablecoin', 'usdt', 'usdc',
  'layer-2', 'rollup', 'nft', 'web3', 'dao', 'token',
  'sec', 'regulation', 'etf', 'spot', 'futures',
];

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  markets: string[];
  conditionId: string;
  volume: number;
  liquidity: number;
  outcomePrices: string[];
  endDateIso: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  winner: string | null;
  categories: string[];
  dailyVolume: number;
  weeklyVolume: number;
}

interface PredictionOutcome {
  label: string;
  price: number;
  probabilityPercent: number;
}

interface PredictionMarket {
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

interface PolymarketResponse {
  markets: PredictionMarket[];
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  signalReason: string;
  bullishCount: number;
  bearishCount: number;
  cryptoRelevantCount: number;
  totalVolume: number;
  timestamp: number;
}

function isCryptoRelevant(market: PolymarketMarket): boolean {
  const text = [
    market.question,
    market.description,
    ...(market.categories ?? []),
  ].join(' ').toLowerCase();
  return CRYPTO_KEYWORDS.some(kw => text.includes(kw));
}

function interpretSentiment(
  market: PolymarketMarket,
  outcomes: PredictionOutcome[]
): { sentiment: PredictionMarket['sentiment']; score: number } {
  if (market.resolved) {
    if (market.winner === null) return { sentiment: 'uncertain', score: 50 };
    const winningOutcome = outcomes.find(
      o => o.label.toLowerCase() === market.winner?.toLowerCase()
    );
    const prob = winningOutcome?.probabilityPercent ?? 50;
    return {
      sentiment: prob >= 65 ? 'bullish' : prob <= 35 ? 'bearish' : 'neutral',
      score: prob,
    };
  }
  if (outcomes.length === 2) {
    const yesProb = outcomes.find(o => o.label.toLowerCase().includes('yes') || o.label === 'Yes')?.probabilityPercent
      ?? outcomes[0].probabilityPercent;
    const noProb = 100 - yesProb;
    if (yesProb >= 65) return { sentiment: 'bullish', score: yesProb };
    if (yesProb <= 35) return { sentiment: 'bearish', score: yesProb };
    if (yesProb >= 55) return { sentiment: 'neutral', score: yesProb };
    if (noProb >= 55) return { sentiment: 'neutral', score: 100 - noProb };
    return { sentiment: 'uncertain', score: yesProb };
  }
  const maxProb = Math.max(...outcomes.map(o => o.probabilityPercent));
  if (maxProb >= 75) return { sentiment: 'bullish', score: maxProb };
  if (maxProb <= 40) return { sentiment: 'bearish', score: maxProb };
  return { sentiment: 'uncertain', score: maxProb };
}

function generateCryptoSignal(
  market: PolymarketMarket,
  sentiment: PredictionMarket['sentiment'],
  sentimentScore: number
): { signal: PredictionMarket['cryptoSignal']; reason: string } {
  if (!isCryptoRelevant(market)) {
    return { signal: 'n/a', reason: 'Market not directly crypto-related' };
  }
  const questionLower = market.question.toLowerCase();
  if (questionLower.includes('bitcoin') || questionLower.includes('btc $')) {
    if (sentiment === 'bullish' && sentimentScore >= 60) {
      return { signal: 'buy', reason: `Polymarket: ${sentimentScore.toFixed(0)}% BTC bull probability` };
    }
    if (sentiment === 'bearish' && sentimentScore <= 40) {
      return { signal: 'sell', reason: `Polymarket: ${(100 - sentimentScore).toFixed(0)}% BTC bear probability` };
    }
  }
  if (questionLower.includes('ethereum') || questionLower.includes('eth $') || questionLower.includes('eth will')) {
    if (sentiment === 'bullish' && sentimentScore >= 60) {
      return { signal: 'buy', reason: `Polymarket: ${sentimentScore.toFixed(0)}% ETH bull probability` };
    }
    if (sentiment === 'bearish' && sentimentScore <= 40) {
      return { signal: 'sell', reason: `Polymarket: ${(100 - sentimentScore).toFixed(0)}% ETH bear probability` };
    }
  }
  if (questionLower.includes('sec') || questionLower.includes('etf') || questionLower.includes('regulation') || questionLower.includes('approval')) {
    if (sentiment === 'bullish') {
      return { signal: 'buy', reason: `Polymarket: ${sentimentScore.toFixed(0)}% positive regulatory/crypto event probability` };
    }
    if (sentiment === 'bearish') {
      return { signal: 'sell', reason: `Polymarket: ${(100 - sentimentScore).toFixed(0)}% negative regulatory/crypto event probability` };
    }
  }
  if (isCryptoRelevant(market)) {
    if (sentiment === 'bullish' && sentimentScore >= 65) {
      return { signal: 'buy', reason: `Polymarket: ${sentimentScore.toFixed(0)}% positive — crypto-adjacent` };
    }
    if (sentiment === 'bearish' && sentimentScore <= 35) {
      return { signal: 'sell', reason: `Polymarket: ${(100 - sentimentScore).toFixed(0)}% negative — crypto-adjacent` };
    }
  }
  return { signal: 'hold', reason: `Polymarket: ${sentimentScore.toFixed(0)}% probability — mixed signal` };
}

async function fetchMarkets(): Promise<PolymarketMarket[]> {
  try {
    const url = `${GAMMA_BASE}/markets?limit=100&closed=false&order=volume&direction=desc`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    return res.json() as Promise<PolymarketMarket[]>;
  } catch {
    return [];
  }
}

async function fetchMarketPrices(marketIds: string[]): Promise<Map<string, string[]>> {
  try {
    const pricesUrl = `${CLOB_BASE}/prices?ids=${marketIds.join(',')}`;
    const res = await fetch(pricesUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Map();
    const data = await res.json() as Record<string, string[]>;
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

// GET /api/polymarket
router.get('/polymarket', async (req, res) => {
  const filter = (req.query.filter as string) || 'all';
  const cacheKey = `polymarket:${filter}`;
  const CACHE_TTL = 300;

  const cached = get<PolymarketResponse>(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, cached: true });
    return;
  }

  try {
    const markets = await fetchMarkets();
    if (markets.length === 0) {
      res.json({ data: buildEmptyResponse() });
      return;
    }

    const filteredMarkets = filter !== 'all' && filter !== 'crypto'
      ? markets.filter(m => m.categories?.some(c => c.toLowerCase().includes(filter.toLowerCase())))
      : markets;
    const cryptoRelevant = markets.filter(m => isCryptoRelevant(m));
    const relevantIds = new Set([...filteredMarkets, ...cryptoRelevant].map(m => m.id));
    const relevantMarkets = markets.filter(m => relevantIds.has(m.id));
    const topMarkets = relevantMarkets
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 50);

    const marketIds = topMarkets.map(m => m.conditionId);
    const pricesMap = await fetchMarketPrices(marketIds);

    const predictionMarkets: PredictionMarket[] = [];
    let bullishCount = 0;
    let bearishCount = 0;
    let totalVolume = 0;
    let cryptoRelevantCount = 0;

    for (const market of topMarkets) {
      let outcomePrices: string[] = market.outcomePrices ?? [];
      if (outcomePrices.length === 0) {
        const clobPrices = pricesMap.get(market.conditionId);
        if (clobPrices && clobPrices.length > 0) outcomePrices = clobPrices;
      }

      const outcomes: PredictionOutcome[] = (market.markets ?? []).map((outcome, i) => {
        const price = outcomePrices[i] ? parseFloat(outcomePrices[i]) : (1 / (market.markets?.length ?? 2));
        return {
          label: outcome,
          price: Math.max(0.001, Math.min(0.999, price)),
          probabilityPercent: Math.max(0.1, Math.min(99.9, price * 100)),
        };
      });

      if (outcomes.length === 0 && outcomePrices.length === 2) {
        const [p1, p2] = outcomePrices.map(parseFloat);
        outcomes.push(
          { label: 'Yes', price: Math.max(0.001, Math.min(0.999, p1)), probabilityPercent: Math.max(0.1, Math.min(99.9, p1 * 100)) },
          { label: 'No', price: Math.max(0.001, Math.min(0.999, p2)), probabilityPercent: Math.max(0.1, Math.min(99.9, p2 * 100)) },
        );
      }

      if (outcomes.length === 0) {
        outcomes.push({ label: 'Yes', price: 0.5, probabilityPercent: 50 }, { label: 'No', price: 0.5, probabilityPercent: 50 });
      }

      const { sentiment, score } = interpretSentiment(market, outcomes);
      const { signal, reason } = generateCryptoSignal(market, sentiment, score);

      if (signal === 'buy') bullishCount++;
      if (signal === 'sell') bearishCount++;
      if (isCryptoRelevant(market)) cryptoRelevantCount++;
      totalVolume += market.volume ?? 0;

      predictionMarkets.push({
        id: market.id,
        question: market.question,
        summary: market.description ?? market.question,
        outcomes,
        volume24h: market.dailyVolume ?? 0,
        volume7d: market.weeklyVolume ?? 0,
        totalVolume: market.volume ?? 0,
        liquidity: market.liquidity ?? 0,
        endDate: market.endDateIso,
        resolved: market.resolved,
        winner: market.winner,
        categories: market.categories ?? [],
        sentiment,
        sentimentScore: score,
        cryptoSignal: signal,
        signalReason: reason,
        lastUpdated: market.updatedAt,
      });
    }

    let overallSignal: PolymarketResponse['overallSignal'] = 'neutral';
    let signalReason = `${cryptoRelevantCount} crypto-relevant markets on Polymarket`;

    if (bullishCount > bearishCount * 2 && bullishCount >= 5) {
      overallSignal = 'bullish';
      signalReason = `${bullishCount} buy signals vs ${bearishCount} sell signals from Polymarket prediction markets`;
    } else if (bearishCount > bullishCount * 2 && bearishCount >= 5) {
      overallSignal = 'bearish';
      signalReason = `${bearishCount} sell signals vs ${bullishCount} buy signals from Polymarket prediction markets`;
    } else if (cryptoRelevantCount >= 10) {
      if (bullishCount > bearishCount) {
        overallSignal = 'bullish';
        signalReason = `Slight crypto bull lean: ${bullishCount} buy vs ${bearishCount} sell`;
      } else if (bearishCount > bullishCount) {
        overallSignal = 'bearish';
        signalReason = `Slight crypto bear lean: ${bearishCount} sell vs ${bullishCount} buy`;
      }
    }

    const response: PolymarketResponse = {
      markets: predictionMarkets,
      overallSignal,
      signalReason,
      bullishCount,
      bearishCount,
      cryptoRelevantCount,
      totalVolume,
      timestamp: Date.now(),
    };

    set(cacheKey, response, CACHE_TTL);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: response });
  } catch (err) {
    console.error('Polymarket API error:', err);
    res.status(500).json({ error: 'Failed to fetch Polymarket data' });
  }
});

function buildEmptyResponse(): PolymarketResponse {
  return {
    markets: [],
    overallSignal: 'neutral',
    signalReason: 'No Polymarket data available',
    bullishCount: 0,
    bearishCount: 0,
    cryptoRelevantCount: 0,
    totalVolume: 0,
    timestamp: Date.now(),
  };
}

export default router;
