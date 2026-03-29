import { useFdvRatio } from '../hooks/useFdvRatio';
import { AlertTriangle, TrendingDown, Minus, ArrowUp } from 'lucide-react';

function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e9) return '$' + (abs / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(0) + 'K';
  return '$' + abs.toFixed(0);
}

function riskColor(risk: 'low' | 'medium' | 'high' | 'extreme'): string {
  switch (risk) {
    case 'low': return 'text-signal-buy';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'extreme': return 'text-signal-sell';
  }
}

function riskBg(risk: 'low' | 'medium' | 'high' | 'extreme'): string {
  switch (risk) {
    case 'low': return 'bg-signal-buy/10 border-signal-buy/20';
    case 'medium': return 'bg-yellow-400/10 border-yellow-400/20';
    case 'high': return 'bg-orange-400/10 border-orange-400/20';
    case 'extreme': return 'bg-signal-sell/10 border-signal-sell/20';
  }
}

export function FdvRatioCard() {
  const { data, loading, error } = useFdvRatio();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-36 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-dark-muted rounded w-48" />
          <div className="h-3 bg-dark-muted rounded w-40" />
          <div className="h-3 bg-dark-muted rounded w-44" />
        </div>
      </div>
    );
  }

  if (error || !data || data.tokens.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="text-xs text-gray-500 font-mono mb-2">FDV / CIRCULATING RATIO</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const SignalIcon = data.signal === 'sell' ? TrendingDown
    : data.signal === 'buy' ? ArrowUp
    : Minus;

  const signalColor = data.signal === 'sell' ? 'text-signal-sell'
    : data.signal === 'buy' ? 'text-signal-buy'
    : 'text-gray-400';

  const topTokens = data.tokens.slice(0, 5);

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">FDV / Circulating Ratio</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Hidden Sell Pressure</div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor} />
          <span className={`text-xs font-semibold ${signalColor}`}>
            {data.signal === 'sell' ? 'Sell Risk' : data.signal === 'buy' ? 'Low Risk' : 'Hold'}
          </span>
        </div>
      </div>

      {/* Token List */}
      <div className="space-y-1.5 mb-3">
        {topTokens.map((token) => (
          <div key={token.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-dark-base">
            {/* Rank */}
            <span className="text-[10px] text-gray-600 w-4 text-center shrink-0">{token.rank}</span>

            {/* Symbol */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-200 truncate">{token.symbol}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${riskBg(token.riskLevel)} ${riskColor(token.riskLevel)}`}>
                  {token.ratio.toFixed(1)}x
                </span>
              </div>
            </div>

            {/* Hidden pressure */}
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-400 font-mono">{formatUsd(token.hiddenSellPressure)}</div>
              <div className="text-[10px] text-gray-600">hidden</div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk threshold note */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={10} className="text-orange-400 mt-0.5 shrink-0" />
          <div className="text-[10px] text-gray-400 leading-relaxed">
            Ratio &gt; 5x = elevated unlock risk. {data.highRiskCount} token{data.highRiskCount !== 1 ? 's' : ''} flagged.
          </div>
        </div>
      </div>

      {/* Historical note */}
      <div className="text-[10px] text-gray-600 leading-relaxed mb-2">
        Historical: &gt;10x ratio → -23% avg performance (90d post-listing)
      </div>

      {/* Signal interpretation */}
      <div className="text-[10px] text-gray-500 leading-relaxed">
        {data.signalReason}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-2">
        <span className="text-[10px] text-gray-600">Source: CoinGecko</span>
        <span className="text-[10px] text-gray-600">Top 20</span>
      </div>
    </div>
  );
}
