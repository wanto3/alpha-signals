import { Router } from 'express';
import { get, set } from '../middleware/cache.js';
import { rateLimit, DEFAULT_RATE_LIMIT } from '../middleware/rateLimit.js';

const router = Router();
router.use(rateLimit(DEFAULT_RATE_LIMIT));

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  fully_diluted_valuation: number | null;
  circulating_supply: number;
  total_supply: number | null;
  price_change_percentage_24h: number;
}

interface TokenFdvRatio {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  fdv: number;
  circulatingMarketCap: number;
  ratio: number;
  hiddenSellPressure: number;
  priceChange24h: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  rank: number;
}

interface FdvRatioResponse {
  tokens: TokenFdvRatio[];
  signal: 'buy' | 'sell' | 'hold';
  signalReason: string;
  highRiskCount: number;
  timestamp: number;
}

const STABLECOINS = ['usdt', 'usdc', 'dai', 'frax', 'busd', 'gusd', 'husd', 'susd'];

function getRiskLevel(ratio: number): TokenFdvRatio['riskLevel'] {
  if (ratio < 3) return 'low';
  if (ratio < 5) return 'medium';
  if (ratio < 10) return 'high';
  return 'extreme';
}

// GET /api/fdv-ratio
router.get('/fdv-ratio', async (_req, res) => {
  const CACHE_KEY = 'fdv-ratio:v1';
  const CACHE_TTL = 3600;

  const cached = get<FdvRatioResponse>(CACHE_KEY);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h&sparkline=false';
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const data = (await resp.json()) as CoinGeckoMarket[];
    const tokens: TokenFdvRatio[] = [];

    for (const coin of data) {
      if (!coin.current_price || !coin.circulating_supply) continue;
      if (STABLECOINS.includes(coin.id)) continue;

      const price = coin.current_price;
      const fdv = coin.fully_diluted_valuation ?? (coin.total_supply ?? coin.circulating_supply) * price;
      const circMarketCap = coin.circulating_supply * price;

      if (fdv <= 0 || circMarketCap <= 0) continue;
      const ratio = fdv / circMarketCap;
      if (ratio < 1.01) continue;
      if (circMarketCap < 1e6) continue;

      tokens.push({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price,
        marketCap: coin.market_cap,
        fdv,
        circulatingMarketCap: circMarketCap,
        ratio,
        hiddenSellPressure: fdv - circMarketCap,
        priceChange24h: coin.price_change_percentage_24h ?? 0,
        riskLevel: getRiskLevel(ratio),
        rank: coin.market_cap > 0 ? Math.round(Math.log10(coin.market_cap)) : 0,
      });
    }

    tokens.sort((a, b) => b.ratio - a.ratio);
    const ranked: TokenFdvRatio[] = tokens.slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 }));

    const highRiskCount = ranked.filter(t => t.riskLevel === 'high' || t.riskLevel === 'extreme').length;
    const avgRatio = ranked.length > 0 ? ranked.reduce((s, t) => s + t.ratio, 0) / ranked.length : 1;

    let signal: FdvRatioResponse['signal'] = 'hold';
    let signalReason = 'FDV ratios within normal range';

    if (highRiskCount >= 5 && avgRatio > 5) {
      signal = 'sell';
      signalReason = `${highRiskCount} tokens with >5x FDV/circulating ratio — elevated hidden sell pressure across top tokens`;
    } else if (highRiskCount >= 3) {
      signal = 'hold';
      signalReason = `${highRiskCount} tokens flagged for high FDV dilution risk`;
    } else if (highRiskCount === 0 && avgRatio < 3) {
      signal = 'buy';
      signalReason = 'Most top tokens have low FDV dilution — minimal hidden sell pressure';
    }

    const response: FdvRatioResponse = {
      tokens: ranked,
      signal,
      signalReason,
      highRiskCount,
      timestamp: Date.now(),
    };

    set(CACHE_KEY, response, CACHE_TTL);
    res.setHeader('X-Cache', 'MISS');
    res.json({ data: response });
  } catch (err) {
    console.error('FDV ratio API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
