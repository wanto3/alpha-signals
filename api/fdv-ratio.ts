import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from './cache.js';

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
  ratio: number; // FDV / Circulating Market Cap
  hiddenSellPressure: number; // FDV - Circulating Market Cap (USD)
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

function getRiskLevel(ratio: number): TokenFdvRatio['riskLevel'] {
  if (ratio < 3) return 'low';
  if (ratio < 5) return 'medium';
  if (ratio < 10) return 'high';
  return 'extreme';
}

function formatUsd(amount: number): string {
  if (Math.abs(amount) >= 1e9) return (amount >= 0 ? '+' : '-') + '$' + (Math.abs(amount) / 1e9).toFixed(1) + 'B';
  if (Math.abs(amount) >= 1e6) return (amount >= 0 ? '+' : '-') + '$' + (Math.abs(amount) / 1e6).toFixed(0) + 'M';
  if (Math.abs(amount) >= 1e3) return (amount >= 0 ? '+' : '-') + '$' + (Math.abs(amount) / 1e3).toFixed(0) + 'K';
  return '$' + amount.toFixed(0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Check in-memory cache first (1 hour TTL for FDV data)
  const CACHE_KEY = 'coingecko:fdv-ratio';
  const cached = cacheGet<FdvRatioResponse>(CACHE_KEY);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    // Fetch top tokens by market cap
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

      // Skip stablecoins and wrapper tokens
      const stablecoins = ['usdt', 'usdc', 'dai', 'frax', 'busd', 'gusd', 'husd', 'susd'];
      if (stablecoins.includes(coin.id)) continue;

      // Calculate FDV
      const price = coin.current_price;
      const fdv = coin.fully_diluted_valuation ?? (coin.total_supply ?? coin.circulating_supply) * price;
      const circMarketCap = coin.circulating_supply * price;

      // Skip if FDV equals market cap (fully circulating, no hidden supply)
      if (fdv <= 0 || circMarketCap <= 0) continue;

      const ratio = fdv / circMarketCap;

      // Skip tokens with very low ratio (already mostly circulating)
      if (ratio < 1.01) continue;

      // Skip tiny market cap tokens
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

    // Sort by ratio descending (highest hidden pressure first)
    tokens.sort((a, b) => b.ratio - a.ratio);

    // Add rank based on ratio position
    const ranked: TokenFdvRatio[] = tokens.slice(0, 20).map((t, i) => ({
      ...t,
      rank: i + 1,
    }));

    // Generate signal
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

    cacheSet(CACHE_KEY, response, 3600);
    res.json({ data: response });
  } catch (err) {
    console.error('FDV ratio API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
