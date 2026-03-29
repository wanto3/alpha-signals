import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import type { CoinMarket } from '../lib/coingecko';
import { useCoin } from '../context/CoinContext';

interface WatchlistProps {
  coins: CoinMarket[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSetAlert: (coin: CoinMarket) => void;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 48, h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={positive ? '#3fb950' : '#f85149'} strokeWidth="1.5" />
    </svg>
  );
}

export function Watchlist({ coins, favorites, onToggleFavorite }: WatchlistProps) {
  const { selectedCoinId, setSelectedCoinId } = useCoin();

  return (
    <div className="min-w-[280px] bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle">
        <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-wider">Watchlist</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {coins.map(coin => {
          const positive = (coin.price_change_percentage_24h || 0) >= 0;
          const isSelected = selectedCoinId === coin.id;
          return (
            <div
              key={coin.id}
              onClick={() => setSelectedCoinId(coin.id)}
              className={`px-3 py-2 cursor-pointer border-l-2 transition-colors ${
                isSelected
                  ? 'bg-bg-primary border-l-accent'
                  : 'border-l-transparent hover:bg-bg-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={coin.image} alt={coin.name} className="w-5 h-5 rounded-full shrink-0" />
                  <span className="text-text-primary text-sm font-medium truncate">{coin.symbol.toUpperCase()}</span>
                  <span className="text-xs text-text-secondary truncate">{coin.name}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onToggleFavorite(coin.id); }}
                  className="shrink-0 p-0.5"
                >
                  <Star
                    size={12}
                    className={favorites.includes(coin.id) ? 'text-alert fill-alert' : 'text-text-secondary'}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    ${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {positive ? (
                    <TrendingUp size={12} className="text-gain" />
                  ) : (
                    <TrendingDown size={12} className="text-loss" />
                  )}
                  <span className={`font-mono text-xs font-semibold ${positive ? 'text-gain' : 'text-loss'}`}>
                    {positive ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2) || '0.00'}%
                  </span>
                </div>
              </div>
              {coin.sparkline_in_7d?.price && (
                <div className="mt-1 flex justify-end">
                  <MiniSparkline data={coin.sparkline_in_7d.price} positive={positive} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
