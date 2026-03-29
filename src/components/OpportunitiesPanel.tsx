import { useEffect, useState } from 'react';
import { getOhlc, getMarketCoins } from '../lib/coingecko';
import { useCryptoNews } from '../hooks/useCryptoNews';
import type { SentimentType } from '../hooks/useCryptoNews';
import {
  synthesizeSignal,
  macdValueToStrength,
  type SignalOutput,
} from '../hooks/useSignalSynthesis';
import { OpportunityCard } from './OpportunityCard';
import { EtfFlowCard } from './EtfFlowCard';
import { FdvRatioCard } from './FdvRatioCard';
import { TokenUnlockCard } from './TokenUnlockCard';
import { MvrvCard } from './MvrvCard';
import { PiCycleCard } from './PiCycleCard';
import type { Opportunity } from '../types';

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain =
    changes.slice(0, period).filter((c) => c > 0).reduce((a, b) => a + b, 0) /
    period;
  let avgLoss =
    Math.abs(
      changes.slice(0, period).filter((c) => c < 0).reduce((a, b) => a + b, 0)
    ) / period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = Math.abs(changes[i] < 0 ? changes[i] : 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    if (i === changes.length - 1) return rsi;
  }
  return 50;
}

function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let sum = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const ema: number[] = [sum];
  for (let i = period; i < values.length; i++) {
    sum = values[i] * k + sum * (1 - k);
    ema.push(sum);
  }
  return ema;
}

function calculateSMA(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function getMacdStrength(closes: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (closes.length < 35) return 'neutral';
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  if (ema12.length === 0 || ema26.length === 0) return 'neutral';
  const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const signalEma = calculateEMA(
    closes.map((_, i) =>
      i < 26 ? 0 : ema12[i - 26 + 1] - ema26[i - 26 + 1]
    ),
    9
  );
  const signal =
    signalEma.length > 0 ? signalEma[signalEma.length - 1] : 0;
  return macdValueToStrength(macd, signal);
}

function getTrendStrength(
  closes: number[]
): 'bullish' | 'bearish' | 'neutral' {
  if (closes.length < 50) return 'neutral';
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const latest = closes[closes.length - 1];
  if (latest > sma20 && sma20 > sma50) return 'bullish';
  if (latest < sma20 && sma20 < sma50) return 'bearish';
  return 'neutral';
}

interface SynthesisForCoin {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  opportunity: Opportunity;
  synthesis: SignalOutput;
}

const SIGNAL_LABELS: Record<string, string> = {
  buy: 'Buy Signal',
  sell: 'Sell Signal',
  hold: 'Hold',
};

export function OpportunitiesPanel() {
  const { news } = useCryptoNews();
  const [coins, setCoins] = useState<
    Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_percentage_24h: number;
      image: string;
    }>
  >([]);
  const [syntheses, setSyntheses] = useState<SynthesisForCoin[]>([]);
  const [loadingCoins, setLoadingCoins] = useState(true);
  const [loadingIndicators, setLoadingIndicators] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch top coins by market cap
  useEffect(() => {
    getMarketCoins(1, 20)
      .then((data) => {
        setCoins(
          data.map((c) => ({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            current_price: c.current_price,
            price_change_percentage_24h: c.price_change_percentage_24h,
            image: c.image,
          }))
        );
        setLoadingCoins(false);
      })
      .catch(() => {
        setError('Failed to load market data');
        setLoadingCoins(false);
      });
  }, []);

  // Fetch indicators for each coin and synthesize
  useEffect(() => {
    if (!coins.length) return;

    let cancelled = false;
    const processCoins = async () => {
      setLoadingIndicators(true);
      const results: SynthesisForCoin[] = [];

      // Process in batches to avoid too many concurrent requests
      const batchSize = 4;
      for (let i = 0; i < coins.length && !cancelled; i += batchSize) {
        const batch = coins.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (coin) => {
            try {
              const ohlc = await getOhlc(coin.id, 30);
              if (cancelled || ohlc.length === 0) return;
              const closes = ohlc.map((d) => d.close);
              const rsi = calculateRSI(closes);
              const macd = getMacdStrength(closes);
              const trend = getTrendStrength(closes);

              const { sentiment, count } = (() => {
                const assetNews = news.filter((item) =>
                  [
                    coin.id,
                    coin.symbol,
                    coin.name.toLowerCase(),
                    coin.symbol.toUpperCase(),
                    coin.name.toLowerCase().split(' ')[0],
                  ].some((k) =>
                    item.title.toLowerCase().includes(k.toLowerCase())
                  )
                );
                let pos = 0,
                  neg = 0;
                for (const item of assetNews) {
                  if (item.sentiment === 'positive') pos++;
                  else if (item.sentiment === 'negative') neg++;
                }
                const sent: SentimentType =
                  pos > neg
                    ? 'positive'
                    : neg > pos
                    ? 'negative'
                    : 'neutral';
                return { sentiment: sent, count: assetNews.length };
              })();

              const synthesis = synthesizeSignal({
                rsi,
                macd,
                trend,
                priceChange24h: coin.price_change_percentage_24h,
                newsSentiment: sentiment,
                newsCount: count,
              });

              const opportunity: Opportunity = {
                id: coin.id,
                asset: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: coin.current_price,
                priceChange24h: coin.price_change_percentage_24h,
                convictionScore: synthesis.score,
                signal: synthesis.signal,
                market: 'Crypto',
                reason: SIGNAL_LABELS[synthesis.signal] || 'Signal generated',
                indicators: {
                  rsi: Math.round(rsi),
                  macd,
                  trend,
                },
                updatedAt: 'Just now',
              };

              results.push({
                coinId: coin.id,
                symbol: coin.symbol,
                name: coin.name,
                price: coin.current_price,
                priceChange24h: coin.price_change_percentage_24h,
                opportunity,
                synthesis,
              });
            } catch {
              // skip failed coins
            }
          })
        );
      }

      if (!cancelled) {
        // Sort by synthesis score (highest conviction first)
        results.sort((a, b) => b.synthesis.score - a.synthesis.score);
        setSyntheses(results.slice(0, 12));
        setLoadingIndicators(false);
      }
    };

    processCoins();
    return () => {
      cancelled = true;
    };
  }, [coins, news]);

  if (loadingCoins) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary text-sm">{error}</p>
      </div>
    );
  }

  if (loadingIndicators && syntheses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-text-secondary text-sm">
          Calculating signals...
        </span>
      </div>
    );
  }

  if (syntheses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary text-sm">No opportunities found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-2 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Institutional / macro signals */}
        <EtfFlowCard />
        <FdvRatioCard />
        <TokenUnlockCard />
        <MvrvCard />
        <PiCycleCard />

        {/* Crypto asset signals */}
        {syntheses.map((item, idx) => (
          <OpportunityCard
            key={item.coinId}
            opportunity={item.opportunity}
            index={idx + 3}
            synthesis={{
              score: item.synthesis.score,
              reasons: item.synthesis.reasons,
              confidence: item.synthesis.confidence,
            }}
          />
        ))}
      </div>
    </div>
  );
}
