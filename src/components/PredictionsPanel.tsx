import { usePredictions, type PredictionMarket } from '../hooks/usePredictions';
import { RefreshCw, ExternalLink } from 'lucide-react';

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

function OddsBar({ yesPrice }: { yesPrice: number }) {
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = 100 - yesPercent;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-dark-border flex">
        <div
          className="h-full bg-[#22c55e] transition-all duration-300"
          style={{ width: `${yesPercent}%` }}
        />
        <div
          className="h-full bg-[#ef4444] transition-all duration-300"
          style={{ width: `${noPercent}%` }}
        />
      </div>
    </div>
  );
}

function MarketCard({ market }: { market: PredictionMarket }) {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const polymarketUrl = `https://polymarket.com/event/${market.slug}`;

  return (
    <a
      href={polymarketUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bg-primary rounded-lg p-3 border border-border-subtle hover:border-accent/40 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-text-primary text-sm leading-snug group-hover:text-accent transition-colors line-clamp-2 flex-1">
          {market.question}
        </p>
        <ExternalLink size={10} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
      </div>

      <OddsBar yesPrice={market.yesPrice} />

      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono">
            <span className="text-[#22c55e] font-semibold">{yesPercent}%</span>
            <span className="text-text-secondary mx-0.5">YES</span>
          </span>
          <span className="text-xs font-mono">
            <span className="text-[#ef4444] font-semibold">{noPercent}%</span>
            <span className="text-text-secondary mx-0.5">NO</span>
          </span>
        </div>
        <span className="text-text-secondary text-xs">
          {formatDate(market.endDate)}
        </span>
      </div>
    </a>
  );
}

export function PredictionsPanel() {
  const { markets, loading, error, refetch } = usePredictions();

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
          <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error && markets.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-text-secondary text-xs mb-1">Failed to load markets</p>
          <button onClick={refetch} className="text-xs text-accent hover:underline">Try again</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
