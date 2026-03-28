import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OpportunityCard } from './components/OpportunityCard';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { EmptyState } from './components/EmptyState';
import { fetchPrices, fetchIndicators, type TickerData, type IndicatorData } from './services/api';
import type { Opportunity } from './types';
import { Filter } from 'lucide-react';

type FilterSignal = 'all' | 'buy' | 'sell' | 'hold';

const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  DOGE: 'Dogecoin',
  XRP: 'Ripple',
  LINK: 'Chainlink',
  ADA: 'Cardano',
  ARB: 'Arbitrum',
  MATIC: 'Polygon',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  UNI: 'Uniswap',
};

function deriveSignal(rsi: number | null, macdHistogram: number | null): Opportunity['signal'] {
  if (rsi === null) return 'hold';
  if (rsi < 35 && (macdHistogram === null || macdHistogram > 0)) return 'buy';
  if (rsi > 68 && (macdHistogram === null || macdHistogram < 0)) return 'sell';
  return 'hold';
}

function deriveTrend(rsi: number | null, macdHistogram: number | null, change: number): string {
  if (rsi === null) return change >= 0 ? 'uptrend' : 'downtrend';
  if (rsi < 40 || macdHistogram === null || macdHistogram > 0) return 'uptrend';
  if (rsi > 60 || macdHistogram < 0) return 'downtrend';
  return 'range';
}

function deriveMacdString(macdLine: number | null, macdSignal: number | null): string {
  if (macdLine === null || macdSignal === null) return 'neutral';
  if (macdLine > macdSignal) return 'bullish';
  if (macdLine < macdSignal) return 'bearish';
  return 'neutral';
}

function computeConviction(
  rsi: number | null,
  macdHistogram: number | null,
  change24h: number
): number {
  let score = 5.0;

  if (rsi !== null) {
    if (rsi < 30) score += 1.5;
    else if (rsi < 40) score += 1.0;
    else if (rsi > 70) score -= 1.5;
    else if (rsi > 60) score -= 1.0;
  }

  if (macdHistogram !== null) {
    if (macdHistogram > 0) score += 1.0;
    else if (macdHistogram < 0) score -= 1.0;
  }

  if (Math.abs(change24h) > 5) score += 0.5;
  if (Math.abs(change24h) > 10) score += 0.5;

  return Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10));
}

function buildOpportunity(ticker: TickerData, indicators: IndicatorData): Opportunity {
  const name = ASSET_NAMES[ticker.symbol] || ticker.symbol;
  const rsi = indicators.rsi_14;
  const macdHistogram = indicators.macd_histogram;
  const macdLine = indicators.macd_line;
  const macdSignal = indicators.macd_signal;
  const change = ticker.priceChangePercent;

  return {
    id: ticker.symbol,
    asset: name,
    symbol: ticker.symbol,
    price: ticker.price,
    priceChange24h: change,
    convictionScore: computeConviction(rsi, macdHistogram, change),
    signal: deriveSignal(rsi, macdHistogram),
    market: 'Crypto',
    reason: generateReason(name, ticker.symbol, rsi, macdLine, macdHistogram, change),
    indicators: {
      rsi: rsi !== null ? Math.round(rsi) : 50,
      macd: deriveMacdString(macdLine, macdSignal),
      trend: deriveTrend(rsi, macdHistogram, change),
    },
    updatedAt: 'just now',
  };
}

function buildOpportunityFromTicker(ticker: TickerData): Opportunity {
  const name = ASSET_NAMES[ticker.symbol] || ticker.symbol;
  const change = ticker.priceChangePercent;
  const signal: Opportunity['signal'] = change > 3 ? 'buy' : change < -3 ? 'sell' : 'hold';

  return {
    id: ticker.symbol,
    asset: name,
    symbol: ticker.symbol,
    price: ticker.price,
    priceChange24h: change,
    convictionScore: computeConviction(null, null, change),
    signal,
    market: 'Crypto',
    reason: `${name} is showing ${Math.abs(change).toFixed(2)}% price movement in the last 24h.`,
    indicators: { rsi: 50, macd: 'neutral', trend: change >= 0 ? 'uptrend' : 'downtrend' },
    updatedAt: 'just now',
  };
}

function generateReason(
  name: string,
  _symbol: string,
  rsi: number | null,
  _macdLine: number | null,
  macdHistogram: number | null,
  change: number
): string {
  const parts: string[] = [];

  if (rsi !== null) {
    if (rsi < 30) parts.push(`${name} is deeply oversold (RSI ${Math.round(rsi)}) — potential reversal signal.`);
    else if (rsi < 40) parts.push(`${name} RSI at ${Math.round(rsi)} — approaching oversold territory.`);
    else if (rsi > 70) parts.push(`${name} is overbought (RSI ${Math.round(rsi)}) — take profit risk elevated.`);
    else if (rsi > 60) parts.push(`${name} RSI elevated at ${Math.round(rsi)} — caution on new longs.`);
  }

  if (macdHistogram !== null) {
    if (macdHistogram > 0) parts.push('MACD histogram positive — bullish momentum building.');
    else if (macdHistogram < 0) parts.push('MACD histogram negative — bearish pressure present.');
  }

  if (parts.length === 0) {
    parts.push(`${name} trading with ${Math.abs(change).toFixed(2)}% 24h movement.`);
  }

  return parts.join(' ');
}

function App() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('just now');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterSignal>('all');
  const [sortBy, setSortBy] = useState<'conviction' | 'change' | 'price'>('conviction');

  const fetchOpportunities = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const tickers = await fetchPrices();

      const enriched = await Promise.allSettled(
        tickers.map(async (ticker: TickerData) => {
          try {
            const indicators = await fetchIndicators(ticker.symbol);
            return buildOpportunity(ticker, indicators);
          } catch {
            return buildOpportunityFromTicker(ticker);
          }
        })
      );

      const valid = enriched
        .filter((r): r is PromiseFulfilledResult<Opportunity> => r.status === 'fulfilled')
        .map(r => r.value);

      if (valid.length === 0) {
        setError('No market data available. Please check your connection.');
      } else {
        setOpportunities(valid);
        setLastUpdated('just now');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch market opportunities.';
      setError(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const filtered = opportunities
    .filter(op => filter === 'all' || op.signal === filter)
    .sort((a, b) => {
      if (sortBy === 'conviction') return b.convictionScore - a.convictionScore;
      if (sortBy === 'change') return Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h);
      return b.price - a.price;
    });

  const signalCounts = {
    all: opportunities.length,
    buy: opportunities.filter(o => o.signal === 'buy').length,
    sell: opportunities.filter(o => o.signal === 'sell').length,
    hold: opportunities.filter(o => o.signal === 'hold').length,
  };

  return (
    <div className="flex min-h-screen bg-dark-base">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <Header
          lastUpdated={lastUpdated}
          onRefresh={fetchOpportunities}
          isRefreshing={isRefreshing}
        />

        <div className="flex-1 p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Alpha Opportunities</h1>
            <p className="text-gray-400 text-sm">
              High-conviction signals ranked by our AI agents
            </p>
          </div>

          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-lg p-1">
              {(['all', 'buy', 'sell', 'hold'] as FilterSignal[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === f
                      ? f === 'buy' ? 'bg-signal-buy/20 text-signal-buy' :
                        f === 'sell' ? 'bg-signal-sell/20 text-signal-sell' :
                        f === 'hold' ? 'bg-signal-hold/20 text-signal-hold' :
                        'bg-accent-primary/20 text-accent-glow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-xs opacity-60">{signalCounts[f]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
              <Filter size={12} />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent border-none text-gray-400 text-xs focus:outline-none cursor-pointer"
              >
                <option value="conviction">Top Conviction</option>
                <option value="change">Biggest Move</option>
                <option value="price">Highest Price</option>
              </select>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchOpportunities} />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((op, i) => (
                <OpportunityCard key={op.id} opportunity={op} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
