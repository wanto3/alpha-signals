import { useEtfFlows, formatFlow } from '../hooks/useEtfFlows';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function EtfFlowCard() {
  const { data, loading, error } = useEtfFlows();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-36 mb-3" />
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
        <div className="text-xs text-gray-500 font-mono mb-2">ETF FLOW MOMENTUM</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const btcNet = data.btc.totalNetFlow7d;
  const ethNet = data.eth.totalNetFlow7d;
  const btcConsecutive = data.btc.consecutiveInflowDays;
  const btcPrice = data.btcPriceChange24h;
  const divergence = data.divergence;

  const btcPositive = btcNet >= 0;
  const ethPositive = ethNet >= 0;
  const pricePositive = btcPrice >= 0;

  const SignalIcon = data.signal === 'bullish' ? TrendingUp
    : data.signal === 'bearish' ? TrendingDown
    : Minus;

  const signalColor = data.signal === 'bullish' ? 'text-signal-buy'
    : data.signal === 'bearish' ? 'text-signal-sell'
    : 'text-gray-400';

  const flowColor = (positive: boolean) => positive ? 'text-signal-buy' : 'text-signal-sell';
  const neutralColor = 'text-gray-400';

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">ETF Flow Momentum</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Institutional Money Flow</div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor} />
          <span className={`text-xs font-semibold ${signalColor}`}>
            {data.signalLabel}
          </span>
        </div>
      </div>

      {/* BTC ETF Flows */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">BTC ETFs (7-day net)</span>
          <span className={`text-sm font-mono font-semibold ${flowColor(btcPositive)}`}>
            {formatFlow(btcNet)}
          </span>
        </div>

        {/* Individual ETF breakdown */}
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          {data.btc.etfs.slice(0, 3).map((etf) => (
            <div key={etf.ticker} className="text-center">
              <div className="text-[10px] text-gray-600">{etf.ticker}</div>
              <div className={`text-xs font-mono ${flowColor(etf.netFlow7d >= 0)}`}>
                {formatFlow(etf.netFlow7d)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ETH ETF Flows */}
      <div className="mb-3 pb-3 border-b border-dark-border">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">ETH ETFs (7-day net)</span>
          <span className={`text-sm font-mono font-semibold ${flowColor(ethPositive)}`}>
            {formatFlow(ethNet)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          {data.eth.etfs.slice(0, 3).map((etf) => (
            <div key={etf.ticker} className="text-center">
              <div className="text-[10px] text-gray-600">{etf.ticker}</div>
              <div className={`text-xs font-mono ${flowColor(etf.netFlow7d >= 0)}`}>
                {formatFlow(etf.netFlow7d)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Momentum & Divergence */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-400">Momentum</span>
          <span className={`text-xs font-mono ${btcConsecutive >= 3 ? 'text-signal-buy' : neutralColor}`}>
            {btcConsecutive > 0
              ? `${btcConsecutive} consecutive inflow day${btcConsecutive > 1 ? 's' : ''}`
              : 'No inflow streak'}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-400">vs BTC Price</span>
          <span className="text-xs font-mono">
            <span className={flowColor(pricePositive)}>
              {pricePositive ? '+' : ''}{btcPrice.toFixed(2)}%
            </span>
            <span className="text-gray-600 ml-1">
              ({divergence === 'aligned' ? 'aligned' : divergence === 'positive' ? 'diverging +' : 'diverging -'})
            </span>
          </span>
        </div>
      </div>

      {/* Signal interpretation */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="text-xs text-gray-400 leading-relaxed">
          {data.signalReason}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-600">Source: Yahoo Finance</span>
        <span className="text-[10px] text-gray-600">7D</span>
      </div>
    </div>
  );
}
