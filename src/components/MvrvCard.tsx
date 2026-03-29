import { useMvrv } from '../hooks/useMvrv';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

function formatBtcPrice(price: number): string {
  if (price >= 100000) return '$' + (price / 1000).toFixed(0) + 'K';
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return '$' + price.toFixed(2);
}

function formatCap(amount: number): string {
  if (amount >= 1e12) return '$' + (amount / 1e12).toFixed(2) + 'T';
  if (amount >= 1e9) return '$' + (amount / 1e9).toFixed(1) + 'B';
  if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(0) + 'M';
  return '$' + amount.toFixed(0);
}

function zoneColor(zone: string): string {
  switch (zone) {
    case 'undervalued': return 'text-signal-buy';
    case 'neutral': return 'text-gray-400';
    case 'elevated': return 'text-yellow-400';
    case 'extreme': return 'text-signal-sell';
    default: return 'text-gray-400';
  }
}

function zoneBg(zone: string): string {
  switch (zone) {
    case 'undervalued': return 'bg-signal-buy/10 border-signal-buy/20';
    case 'neutral': return 'bg-gray-500/10 border-gray-500/20';
    case 'elevated': return 'bg-yellow-400/10 border-yellow-400/20';
    case 'extreme': return 'bg-signal-sell/10 border-signal-sell/20';
    default: return 'bg-gray-500/10 border-gray-500/20';
  }
}

function zScoreBar(zScore: number): { width: string; color: string } {
  // Z-score typically ranges from -3 to +7
  // Map to 0-100%
  const pct = Math.min(100, Math.max(0, ((zScore + 3) / 10) * 100));
  let color = 'bg-signal-buy';
  if (zScore > 0) color = 'bg-yellow-400';
  if (zScore > 2) color = 'bg-orange-400';
  if (zScore > 4) color = 'bg-signal-sell';
  return { width: pct.toFixed(0) + '%', color };
}

export function MvrvCard() {
  const { data, loading, error } = useMvrv();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-40 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-dark-muted rounded w-48" />
          <div className="h-3 bg-dark-muted rounded w-40" />
          <div className="h-3 bg-dark-muted rounded w-36" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="text-xs text-gray-500 font-mono mb-2">MVRV Z-SCORE</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const { color } = zScoreBar(data.zScore);
  const trendPositive = data.ratioChange7d >= 0;
  const SignalIcon = data.signal === 'buy' ? TrendingUp
    : data.signal === 'sell' ? TrendingDown
    : Minus;
  const signalColor = data.signal === 'buy' ? 'text-signal-buy'
    : data.signal === 'sell' ? 'text-signal-sell'
    : 'text-gray-400';

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">MVRV Z-Score</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Market Cycle Indicator</div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor} />
          <span className={`text-xs font-semibold ${signalColor}`}>
            {data.signalLabel}
          </span>
        </div>
      </div>

      {/* Main metrics */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">MVRV Ratio</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-mono font-bold ${zoneColor(data.zone)}`}>
              {data.ratio.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">
              {trendPositive ? '+' : ''}{data.ratioChange7d.toFixed(2)} (7d)
            </span>
            <span className={trendPositive ? 'text-signal-buy' : 'text-signal-sell'}>
              {trendPositive ? '↑' : '↓'}
            </span>
          </div>
        </div>

        {/* Z-Score gauge */}
        <div className="mb-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-gray-400">Z-Score</span>
            <span className={`text-sm font-mono font-bold ${zoneColor(data.zone)}`}>
              {data.zScore.toFixed(2)}
            </span>
          </div>
          {/* Gauge bar */}
          <div className="relative h-2 bg-dark-base rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all ${color}`}
              style={{ width: zScoreBar(Math.max(0, data.zScore)).width }}
            />
            {/* 0 marker */}
            <div className="absolute left-[30%] top-0 h-full w-px bg-gray-600 opacity-50" />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] text-gray-600">Undervalued</span>
            <span className="text-[10px] text-gray-600">Neutral</span>
            <span className="text-[10px] text-gray-600">Overvalued</span>
          </div>
        </div>

        {/* Zone indicator */}
        <div className={`rounded p-2 border mb-2 ${zoneBg(data.zone)}`}>
          <div className="flex items-center gap-1.5">
            <Activity size={10} className={zoneColor(data.zone)} />
            <span className={`text-[10px] font-medium ${zoneColor(data.zone)}`}>
              {data.zoneLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Market cap comparison */}
      <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-dark-border">
        <div className="text-center">
          <div className="text-[10px] text-gray-600">Market Cap</div>
          <div className="text-xs font-mono text-gray-300">{formatCap(data.marketCap)}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-600">Realized Cap</div>
          <div className="text-xs font-mono text-gray-300">{formatCap(data.realizedCap)}</div>
        </div>
      </div>

      {/* BTC price */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-400">BTC Price</span>
        <span className="text-sm font-mono font-semibold text-gray-200">
          {formatBtcPrice(data.btcPrice)}
        </span>
      </div>

      {/* Signal interpretation */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="text-[10px] text-gray-400 leading-relaxed">
          {data.signalReason}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-600">Source: Blockchain.com + CoinGecko</span>
        <span className="text-[10px] text-gray-600">Daily</span>
      </div>
    </div>
  );
}
