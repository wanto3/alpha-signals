import { useMemo } from 'react';
import type { NewsItem, SentimentType } from './useCryptoNews';

const ASSET_ALIASES: Record<string, string[]> = {
  bitcoin: ['bitcoin', 'btc', 'xbt'],
  ethereum: ['ethereum', 'eth'],
  solana: ['solana', 'sol'],
  cardano: ['cardano', 'ada'],
  chainlink: ['chainlink', 'link'],
  'polygon-pos': ['polygon', 'matic', 'matic polygon'],
  'binancecoin': ['binancecoin', 'bnb'],
  'uniswap': ['uniswap', 'uni'],
  'litecoin': ['litecoin', 'ltc'],
  'dogecoin': ['dogecoin', 'doge'],
  'ripple': ['ripple', 'xrp'],
  'polkadot': ['polkadot', 'dot'],
  'avalanche-2': ['avalanche', 'avax'],
  'cosmos': ['cosmos', 'atom'],
  'arbitrum': ['arbitrum', 'arb'],
};

export function getAssetKeywords(assetId: string): string[] {
  const lower = assetId.toLowerCase();
  return [lower, ...(ASSET_ALIASES[lower] || [lower.split('-')[0]])];
}

export function filterNewsForAsset(
  news: NewsItem[],
  assetId: string
): NewsItem[] {
  const keywords = getAssetKeywords(assetId);
  return news.filter((item) =>
    keywords.some((k) => item.title.toLowerCase().includes(k))
  );
}

export function getNewsSentimentForAsset(
  news: NewsItem[],
  assetId: string
): { sentiment: SentimentType; count: number } {
  const relevant = filterNewsForAsset(news, assetId);
  if (relevant.length === 0) {
    return { sentiment: 'neutral', count: 0 };
  }

  let positive = 0;
  let negative = 0;
  for (const item of relevant) {
    if (item.sentiment === 'positive') positive++;
    else if (item.sentiment === 'negative') negative++;
  }

  const sentiment: SentimentType =
    positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral';

  return { sentiment, count: relevant.length };
}

export function useAssetNews(news: NewsItem[], assetId: string) {
  return useMemo(
    () => filterNewsForAsset(news, assetId),
    [news, assetId]
  );
}
