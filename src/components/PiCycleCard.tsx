import { usePiCycle } from '../hooks/usePiCycle';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

function formatBtcPrice(price: number): string {
  if (price >= 100000) return '$' + (price / 1000).toFixed(0) + 'K';
  return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatMa(price: number): string {
  if (price >= 100000) return '$' + (price / 1000).toFixed(0) + 'K';
  return '$' + price.toFixed(0);
}

function scoreColor(score: number): string {
  if (score < 25) return 'text-signal-buy';
  if (score < 50) return 'text-green-400';
  if (score < 65) return 'text-yellow-400';
  if (score < 75) return 'text-orange-400';
  return 'text-signal-sell';
}


function componentColor(status: string): string {
  switch (status) {
    case 'bullish': return 'text-signal-buy';
    case 'bearish': return 'text-signal-sell';
    default: return 'text-gray-400';
  }
}

function componentBar(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`;
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'early': return 'text-signal-buy';
    case 'mid': return 'text-gray-400';
    case 'late': return 'text-orange-400';
    case 'peak': return 'text-signal-sell';
    default: return 'text-gray-400';
  }
}

export function PiCycleCard() {
  const { data, loading, error } = usePiCycle();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-44 mb-3" />
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
        <div className="text-xs text-gray-500 font-mono mb-2">PI CYCLE TOP</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const SignalIcon = data.compositeSignal === 'buy' ? TrendingUp
    : data.compositeSignal === 'sell' ? TrendingDown
    : Minus;
  const signalColor = data.compositeSignal === 'buy' ? 'text-signal-buy'
    : data.compositeSignal === 'sell' ? 'text-signal-sell'
    : 'text-gray-400';

  // Composite score gauge: 0-100 bar
  const scoreBarWidth = `${Math.min(100, data.compositeScore)}%`;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Bitcoin Cycle Score</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Composite Cycle Indicator</div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor} />
          <span className={`text-xs font-semibold ${signalColor}`}>
            {data.compositeSignalLabel}
          </span>
        </div>
      </div>

      {/* Composite Score */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">Composite Score</span>
          <span className={`text-xl font-mono font-bold ${scoreColor(data.compositeScore)}`}>
            {data.compositeScore}/100
          </span>
        </div>

        {/* Score gauge */}
        <div className="relative h-2 bg-dark-base rounded-full overflow-hidden mb-1">
          {/* Zone backgrounds */}
          <div className="absolute left-0 top-0 h-full w-[25%] bg-signal-buy/20" />
          <div className="absolute left-[25%] top-0 h-full w-[40%] bg-gray-500/10" />
          <div className="absolute left-[65%] top-0 h-full w-[35%] bg-signal-sell/20" />
          {/* Score marker */}
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              data.compositeScore < 25 ? 'bg-signal-buy' :
              data.compositeScore < 50 ? 'bg-green-400' :
              data.compositeScore < 65 ? 'bg-yellow-400' :
              data.compositeScore < 75 ? 'bg-orange-400' : 'bg-signal-sell'
            }`}
            style={{ width: scoreBarWidth, minWidth: '4px' }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-signal-buy">BUY &lt;25</span>
          <span className="text-[10px] text-gray-500">HOLD 25-65</span>
          <span className="text-[10px] text-signal-sell">SELL &gt;65</span>
        </div>
      </div>

      {/* Pi Cycle Top Status */}
      <div className={`rounded p-2 border mb-3 ${data.piCycleTopTriggered ? 'bg-signal-sell/10 border-signal-sell/20' : 'bg-dark-base border-dark-border'}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Zap size={10} className={data.piCycleTopTriggered ? 'text-signal-sell' : 'text-gray-500'} />
            <span className="text-[10px] text-gray-400">Pi Cycle Top</span>
          </div>
          <span className={`text-[10px] font-mono font-semibold ${
            data.piCycleTopTriggered ? 'text-signal-sell' : 'text-signal-buy'
          }`}>
            {data.piCycleTopTriggered ? 'TRIGGERED' : 'NOT TRIGGERED'}
          </span>
        </div>
        {data.piCycleTopTriggered && data.piCycleTopCrossPrice ? (
          <div className="text-[10px] text-gray-500">
            Crossed at {formatBtcPrice(data.piCycleTopCrossPrice)}
          </div>
        ) : data.piCycleTopEstTriggerPrice ? (
          <div className="text-[10px] text-gray-500">
            Est. trigger ~{formatBtcPrice(data.piCycleTopEstTriggerPrice)}
          </div>
        ) : (
          <div className="text-[10px] text-gray-500">
            111 SMA × 2 vs 350 SMA
          </div>
        )}
        <div className="text-[10px] text-gray-600 mt-0.5">
          111 SMA×2: {formatMa(data.ma111_2)} | 350 SMA: {formatMa(data.ma350)}
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-1.5 mb-3 pb-3 border-b border-dark-border">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Components</div>
        {data.components.map((comp) => (
          <div key={comp.name} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-20 shrink-0">{comp.name}</span>
            <div className="flex-1 h-1.5 bg-dark-base rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${comp.status === 'bullish' ? 'bg-signal-buy' : comp.status === 'bearish' ? 'bg-signal-sell' : 'bg-gray-500'}`}
                style={{ width: componentBar(comp.score) }}
              />
            </div>
            <span className={`text-[10px] font-mono w-10 text-right ${componentColor(comp.status)}`}>
              {comp.score}
            </span>
          </div>
        ))}
      </div>

      {/* Cycle Phase */}
      <div className="mb-2">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">Cycle Phase</span>
          <span className={`text-xs font-semibold ${phaseColor(data.cyclePhase)}`}>
            {data.cyclePhase.toUpperCase()}
          </span>
        </div>
        <div className="text-[10px] text-gray-500 leading-relaxed">
          {data.cyclePhaseLabel}
        </div>
      </div>

      {/* BTC Price */}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-400">BTC Price</span>
        <span className="text-sm font-mono font-semibold text-gray-200">
          {formatBtcPrice(data.btcPrice)}
        </span>
      </div>

      {/* Signal */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="text-[10px] text-gray-400 leading-relaxed">
          {data.compositeSignalReason}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-600">Source: CoinGecko (self-calculated)</span>
        <span className="text-[10px] text-gray-600">Daily</span>
      </div>
    </div>
  );
}
