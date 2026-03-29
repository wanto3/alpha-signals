import { useTokenUnlocks } from '../hooks/useTokenUnlocks';
import { AlertTriangle, TrendingDown, Minus, Clock } from 'lucide-react';

function formatUsd(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1e9) return '$' + (abs / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(0) + 'M';
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(0) + 'K';
  return '$' + abs.toFixed(0);
}

function shockColor(level: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (level) {
    case 'low': return 'text-signal-buy';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-orange-400';
    case 'critical': return 'text-signal-sell';
  }
}

function shockBg(level: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (level) {
    case 'low': return 'bg-signal-buy/10 border-signal-buy/20';
    case 'medium': return 'bg-yellow-400/10 border-yellow-400/20';
    case 'high': return 'bg-orange-400/10 border-orange-400/20';
    case 'critical': return 'bg-signal-sell/10 border-signal-sell/20';
  }
}

export function TokenUnlockCard() {
  const { data, loading, error } = useTokenUnlocks();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-40 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-dark-muted rounded w-48" />
          <div className="h-3 bg-dark-muted rounded w-40" />
          <div className="h-3 bg-dark-muted rounded w-44" />
        </div>
      </div>
    );
  }

  if (error || !data || data.unlocks.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="text-xs text-gray-500 font-mono mb-2">TOKEN UNLOCK SHOCK INDEX</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const mostCritical = data.mostCritical;
  const topUnlocks = data.unlocks.slice(0, 4);

  const SignalIcon = data.signal === 'sell' ? TrendingDown
    : data.signal === 'buy' ? Minus
    : Minus;

  const signalColor = data.signal === 'sell' ? 'text-signal-sell'
    : data.signal === 'buy' ? 'text-signal-buy'
    : 'text-gray-400';

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Token Unlock Shock Index</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Liquidity Gap Risk</div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor} />
          <span className={`text-xs font-semibold ${signalColor}`}>
            {data.signal === 'sell' ? 'High Risk' : data.signal === 'buy' ? 'Low Risk' : 'Monitor'}
          </span>
        </div>
      </div>

      {/* Most critical unlock */}
      {mostCritical && (
        <div className={`rounded-lg p-3 mb-3 border ${shockBg(mostCritical.shockLevel)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-200">{mostCritical.symbol}</span>
              <span className="text-[10px] text-gray-500">
                {mostCritical.nextUnlockDate}
              </span>
              {mostCritical.vestingType === 'cliff' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-signal-sell/10 text-signal-sell border border-signal-sell/20">
                  CLIFF
                </span>
              )}
            </div>
            <div className={`text-sm font-mono font-bold ${shockColor(mostCritical.shockLevel)}`}>
              {mostCritical.shockIndex.toFixed(1)}x
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center">
              <div className="text-[10px] text-gray-600">Unlock</div>
              <div className="text-xs font-mono text-gray-300">{formatUsd(mostCritical.unlockAmountUsd)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-600">Liquidity</div>
              <div className="text-xs font-mono text-gray-300">{formatUsd(mostCritical.totalLiquidity24h)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-600">VC Pressure</div>
              <div className={`text-xs font-mono ${mostCritical.vcPressureScore >= 60 ? 'text-signal-sell' : 'text-gray-300'}`}>
                {mostCritical.vcPressureScore}/100
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 leading-relaxed bg-dark-base rounded p-1.5">
            {mostCritical.signalReason}
          </div>
        </div>
      )}

      {/* Top unlock list */}
      <div className="space-y-1 mb-3">
        {topUnlocks.map((unlock) => (
          <div key={unlock.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-dark-base">
            <Clock size={10} className="text-gray-600 shrink-0" />
            <span className="text-sm font-semibold text-gray-200 w-12 shrink-0">{unlock.symbol}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500">
                {unlock.daysUntilUnlock}d · {formatUsd(unlock.unlockAmountUsd)}
              </div>
            </div>
            <div className={`text-xs font-mono font-semibold ${shockColor(unlock.shockLevel)}`}>
              {unlock.shockIndex.toFixed(1)}x
            </div>
            {unlock.vestingType === 'cliff' && (
              <AlertTriangle size={10} className="text-signal-sell shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={10} className="text-orange-400 mt-0.5 shrink-0" />
          <div className="text-[10px] text-gray-400 leading-relaxed">
            Shock Index &gt; 3x → historically -18% avg 7d price impact post-unlock
          </div>
        </div>
      </div>

      {/* Signal */}
      <div className="text-[10px] text-gray-500 leading-relaxed mb-2">
        {data.signalReason}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-600">Source: CoinGecko + Unlock Schedules</span>
        <span className="text-[10px] text-gray-600">{data.totalShockTokens} flagged</span>
      </div>
    </div>
  );
}
