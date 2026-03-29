import { usePredictions, type PredictionMarket, type PredictionOutcome } from '../hooks/usePredictions';
import { RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Ended';
    if (diffDays === 1) return '1 day left';
    if (diffDays < 7) return `${diffDays} days left`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatVolume(volume: number): string {
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(0)}K`;
  return `$${volume.toFixed(0)}`;
}

function SignalBadge({ signal }: { signal: PredictionMarket['cryptoSignal'] }) {
  if (signal === 'n/a') return null;
  const config = {
    buy: { label: 'BUY', className: 'bg-green-500/20 text-green-400 border-green-500/30', Icon: TrendingUp },
    sell: { label: 'SELL', className: 'bg-red-500/20 text-red-400 border-red-500/30', Icon: TrendingDown },
    hold: { label: 'HOLD', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', Icon: Minus },
  }[signal] ?? null;
  if (!config) return null;
  const { label, className, Icon } = config;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded border ${className}`}>
      <Icon size={8} />
      {label}
    </span>
  );
}

function SentimentBadge({ sentiment, score }: { sentiment: PredictionMarket['sentiment']; score: number }) {
  const config = {
    bullish: { className: 'text-green-400', label: 'Bull' },
    bearish: { className: 'text-red-400', label: 'Bear' },
    neutral: { className: 'text-gray-400', label: 'Neutral' },
    uncertain: { className: 'text-gray-500', label: 'Uncertain' },
  }[sentiment];
  return (
    <span className={`text-[10px] font-mono ${config.className}`}>
      {config.label} {score.toFixed(0)}%
    </span>
  );
}

function OddsBar({ outcomes }: { outcomes: PredictionOutcome[] }) {
  if (outcomes.length === 0) return null;

  if (outcomes.length === 2) {
    // Binary market: YES vs NO
    const yesOutcome = outcomes.find(o => o.label.toLowerCase() === 'yes') ?? outcomes[0];
    const yesPercent = Math.round(yesOutcome.probabilityPercent);
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-dark-border flex">
          <div
            className="h-full bg-[#22c55e] transition-all duration-300"
            style={{ width: `${yesPercent}%` }}
          />
          <div
            className="h-full bg-[#ef4444] transition-all duration-300"
            style={{ width: `${100 - yesPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Multi-outcome market
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-dark-border">
      {outcomes.map((o, i) => (
        <div
          key={o.label}
          className="transition-all duration-300"
          style={{
            width: `${Math.round(o.probabilityPercent)}%`,
            backgroundColor: colors[i % colors.length],
          }}
        />
      ))}
    </div>
  );
}

function MarketCard({ market }: { market: PredictionMarket }) {
  const polymarketUrl = `https://polymarket.com/event/${market.id}`;

  return (
    <a
      href={polymarketUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bg-primary rounded-lg p-3 border border-border-subtle hover:border-accent/40 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-text-primary text-xs leading-snug group-hover:text-accent transition-colors line-clamp-2 flex-1">
          {market.question}
        </p>
        <ExternalLink size={10} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
      </div>

      <OddsBar outcomes={market.outcomes} />

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <SentimentBadge sentiment={market.sentiment} score={market.sentimentScore} />
          <SignalBadge signal={market.cryptoSignal} />
        </div>
        <div className="flex items-center gap-2">
          {market.totalVolume > 0 && (
            <span className="text-text-secondary text-[10px] font-mono">
              {formatVolume(market.totalVolume)}
            </span>
          )}
          <span className="text-text-secondary text-xs">
            {formatDate(market.endDate)}
          </span>
        </div>
      </div>

      {market.signalReason && market.cryptoSignal !== 'n/a' && (
        <p className="text-[10px] text-text-secondary mt-1 line-clamp-1 opacity-70">
          {market.signalReason}
        </p>
      )}
    </a>
  );
}

function OverallSignalBanner({ signal, reason, bullishCount, bearishCount, cryptoRelevantCount }: {
  signal: 'bullish' | 'bearish' | 'neutral';
  reason: string;
  bullishCount: number;
  bearishCount: number;
  cryptoRelevantCount: number;
}) {
  const config = {
    bullish: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', Icon: TrendingUp, label: 'Bullish' },
    bearish: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', Icon: TrendingDown, label: 'Bearish' },
    neutral: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', Icon: Minus, label: 'Neutral' },
  }[signal];
  const { bg, border, text, Icon, label } = config;

  return (
    <div className={`rounded-lg p-2 border ${bg} ${border} mb-2`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className={text} />
        <span className={`text-xs font-semibold ${text}`}>{label} Overall</span>
        <span className="text-text-secondary text-[10px] ml-auto font-mono">
          {bullishCount}↑ {bearishCount}↓ · {cryptoRelevantCount} crypto
        </span>
      </div>
      <p className="text-[10px] text-text-secondary line-clamp-1">{reason}</p>
    </div>
  );
}

export function PredictionsPanel() {
  const { markets, overallSignal, signalReason, bullishCount, bearishCount, cryptoRelevantCount, loading, error, refetch } = usePredictions();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
          Prediction Markets
        </p>
        <button
          onClick={refetch}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
          title="Refresh markets"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {loading && markets.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error && markets.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-text-secondary text-xs mb-1">Failed to load markets</p>
          <button onClick={refetch} className="text-xs text-accent hover:underline">Try again</button>
        </div>
      ) : (
        <>
          {markets.length > 0 && (
            <OverallSignalBanner
              signal={overallSignal}
              reason={signalReason}
              bullishCount={bullishCount}
              bearishCount={bearishCount}
              cryptoRelevantCount={cryptoRelevantCount}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
