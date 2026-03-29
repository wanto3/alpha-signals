import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from './cache.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Map symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  XRP: 'ripple',
  LINK: 'chainlink',
  ADA: 'cardano',
  ARB: 'arbitrum',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  UNI: 'uniswap',
  OP: 'optimism',
  NEAR: 'near',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  SEI: 'sei-network',
  WLD: 'worldcoin-wld',
  JUP: 'jupiter-agave',
  PYTH: 'pyth-network',
  AXL: 'axelar',
  DYM: 'dymension',
  JASMY: 'jasmycoin',
  STRK: 'starknet',
  SUI: 'sui',
  APT: 'aptos',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  GMX: 'gmx',
  RENDER: 'render-token',
  FIL: 'filecoin',
  ICP: 'internet-computer',
  STX: 'blockstack',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  ALGO: 'algorand',
  VET: 'vechain',
  THETA: 'theta-token',
  APE: 'apecoin',
  FLOW: 'flow',
  CHZ: 'chiliz',
  ENJ: 'enjincoin',
  SLP: 'smooth-love-potion',
  ZIL: 'zilliqa',
  ENS: 'ethereum-name-service',
};

const TRACKED_SYMBOLS = Object.keys(COINGECKO_IDS);

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
}

interface CoinGeckoSimplePrice {
  [id: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

interface TickerData {
  symbol: string;
  price: number;
  volume24h: number;
  quoteVolume24h: number;
  priceChangePercent: number;
  timestamp: number;
}

const CACHE_KEY = 'coingecko:prices';
const CACHE_TTL = 60; // 1 minute — CoinGecko free tier is ~10-30 calls/min

async function fetchPrices(): Promise<TickerData[]> {
  // Check cache first
  const cached = cacheGet<TickerData[]>(CACHE_KEY);
  if (cached) return cached;

  const ids = TRACKED_SYMBOLS.map(s => COINGECKO_IDS[s]).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as CoinGeckoMarket[];

    const result: TickerData[] = data.map(coin => {
      const symbolKey = Object.entries(COINGECKO_IDS).find(([, v]) => v === coin.id)?.[0] ?? coin.symbol.toUpperCase();
      return {
        symbol: symbolKey,
        price: coin.current_price ?? 0,
        volume24h: 0,
        quoteVolume24h: coin.total_volume ?? 0,
        priceChangePercent: coin.price_change_percentage_24h ?? 0,
        timestamp: Date.now(),
      };
    });

    cacheSet(CACHE_KEY, result, CACHE_TTL);
    return result;
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const prices = await fetchPrices();
  res.json({ data: prices });
}
