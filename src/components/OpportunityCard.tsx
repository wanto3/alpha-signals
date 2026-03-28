import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Activity, BarChart2 } from 'lucide-react';
import type { Opportunity } from '../types';

interface Props {
  opportunity: Opportunity;
  index: number;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function ConvictionMeter({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#eab308' : '#ef4444';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-dark-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
        />
      </div>
      <span className="text-lg font-bold tabular-nums" style={{ color }}>{score.toFixed(1)}</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: Opportunity['signal'] }) {
  const config = {
    buy: { label: 'Buy', class: 'signal-buy', icon: TrendingUp },
    sell: { label: 'Sell', class: 'signal-sell', icon: TrendingDown },
    hold: { label: 'Hold', class: 'signal-hold', icon: Minus },
  }[signal];

  const Icon = config.icon;

  return (
    <span className={`signal-badge ${config.class}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

export function OpportunityCard({ opportunity, index }: Props) {
  const isPositive = opportunity.priceChange24h >= 0;
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;
  const changeColor = isPositive ? 'text-signal-buy' : 'text-signal-sell';

  return (
    <div
      className="card animate-slide-up cursor-pointer"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center">
            <span className="text-sm font-bold text-gray-300">{opportunity.symbol.slice(0, 2)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-white text-base leading-tight">{opportunity.asset}</h3>
            <span className="text-xs text-gray-500">{opportunity.market}</span>
          </div>
        </div>
        <SignalBadge signal={opportunity.signal} />
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">
            {formatPrice(opportunity.price)}
          </span>
          <span className={`flex items-center gap-0.5 text-sm font-medium ${changeColor}`}>
            <ChangeIcon size={14} />
            {Math.abs(opportunity.priceChange24h).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Conviction Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">Conviction</span>
          <span className="text-xs text-gray-500">{opportunity.updatedAt}</span>
        </div>
        <ConvictionMeter score={opportunity.convictionScore} />
      </div>

      {/* Reason */}
      <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-2">
        {opportunity.reason}
      </p>

      {/* Indicators */}
      <div className="flex items-center gap-4 pt-3 border-t border-dark-border">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-gray-500" />
          <span className="text-xs text-gray-400">RSI</span>
          <span className={`text-xs font-semibold tabular-nums ${
            opportunity.indicators.rsi < 30 ? 'text-signal-buy' :
            opportunity.indicators.rsi > 70 ? 'text-signal-sell' : 'text-gray-300'
          }`}>
            {opportunity.indicators.rsi}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart2 size={12} className="text-gray-500" />
          <span className="text-xs text-gray-400">MACD</span>
          <span className={`text-xs font-semibold ${
            opportunity.indicators.macd === 'bullish' ? 'text-signal-buy' :
            opportunity.indicators.macd === 'bearish' ? 'text-signal-sell' : 'text-signal-hold'
          }`}>
            {opportunity.indicators.macd}
          </span>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 capitalize">{opportunity.indicators.trend}</span>
      </div>
    </div>
  );
}
