import { useFearGreed } from '../hooks/useFearGreed';
import { TrendingUp, AlertTriangle, Star, ArrowUp } from 'lucide-react';

type SignalStrength = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

interface BannerConfig {
  signal: SignalStrength;
  label: string;
  subtext: string;
  bgFrom: string;
  bgTo: string;
  borderColor: string;
  textColor: string;
  icon: React.ReactNode;
}

export function getSignalStrength(value: number): SignalStrength {
  if (value <= 25) return 'strong_buy';
  if (value <= 45) return 'buy';
  if (value <= 55) return 'neutral';
  if (value <= 75) return 'sell';
  return 'strong_sell';
}

function getBannerConfig(value: number, _classification: string): BannerConfig {
  if (value <= 25) {
    return {
      signal: 'strong_buy',
      label: 'STRONG BUY',
      subtext: 'Extreme Fear detected — historically a strong reversal / accumulation signal.',
      bgFrom: 'from-emerald-950',
      bgTo: 'to-emerald-900',
      borderColor: 'border-emerald-700',
      textColor: 'text-emerald-300',
      icon: <ArrowUp size={18} />,
    };
  }
  if (value <= 45) {
    return {
      signal: 'buy',
      label: 'ACCUMULATION ZONE',
      subtext: 'Fear detected — elevated uncertainty but historically favorable entry points.',
      bgFrom: 'from-amber-950',
      bgTo: 'to-amber-900',
      borderColor: 'border-amber-700',
      textColor: 'text-amber-300',
      icon: <TrendingUp size={18} />,
    };
  }
  if (value <= 55) {
    return {
      signal: 'neutral',
      label: 'NEUTRAL',
      subtext: 'Market sentiment is balanced. No strong directional conviction.',
      bgFrom: 'from-slate-800',
      bgTo: 'to-slate-800',
      borderColor: 'border-slate-600',
      textColor: 'text-slate-300',
      icon: <Star size={18} />,
    };
  }
  if (value <= 75) {
    return {
      signal: 'sell',
      label: 'TAKE PROFIT ZONE',
      subtext: 'Greed elevated — consider taking profits or reducing risk exposure.',
      bgFrom: 'from-orange-950',
      bgTo: 'to-orange-900',
      borderColor: 'border-orange-700',
      textColor: 'text-orange-300',
      icon: <AlertTriangle size={18} />,
    };
  }
  return {
    signal: 'strong_sell',
    label: 'EXTREME GREED',
    subtext: 'Maximum greed — highest risk environment. Reduce exposure significantly.',
    bgFrom: 'from-red-950',
    bgTo: 'to-red-900',
    borderColor: 'border-red-700',
    textColor: 'text-red-300',
    icon: <AlertTriangle size={18} />,
  };
}

export function FearBanner() {
  const { data, loading, error } = useFearGreed();

  if (loading || error || !data) return null;

  const cfg = getBannerConfig(data.value, data.classification);

  return (
    <div
      className={`mx-3 mt-2 rounded-lg border px-4 py-2.5 bg-gradient-to-r ${cfg.bgFrom} ${cfg.bgTo} ${cfg.borderColor}`}
    >
      <div className="flex items-center gap-3">
        <div className={`shrink-0 ${cfg.textColor}`}>
          {cfg.icon}
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono font-bold text-sm tracking-wider ${cfg.textColor}`}>
            {cfg.label}
          </span>
          <span className="text-slate-400 text-xs">
            {cfg.subtext}
          </span>
        </div>
        <div className={`ml-auto shrink-0 font-mono text-xs ${cfg.textColor}`}>
          F&G: {data.value}
        </div>
      </div>
    </div>
  );
}
