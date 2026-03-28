import type { CoinMarket, GlobalData } from '../lib/coingecko';
import { useFearGreed } from '../hooks/useFearGreed';
import { RefreshCw } from 'lucide-react';

interface StatsPanelProps {
  coins: CoinMarket[];
  globalData?: GlobalData['data'];
}

function FearGreedGauge({ value, classification }: { value: number; classification: string }) {
  const color = value <= 25 ? '#f85149' : value <= 45 ? '#f0883e' : value <= 55 ? '#d29922' : value <= 75 ? '#3fb950' : '#2ea043';

  // SVG arc: half-circle gauge
  const cx = 60, cy = 60, r = 48;
  const circumference = Math.PI * r;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="75" viewBox="0 0 120 75">
        <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="#30363d" strokeWidth="6" strokeLinecap="round" />
        <path
          d="M 12 60 A 48 48 0 0 1 108 60"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}50)`, transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize="20" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
          {value}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={color} fontSize="8" fontWeight="600" fontFamily="Inter, sans-serif" opacity="0.8">
          {classification.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function getFgInterpretation(value: number): string {
  if (value < 25) return 'Extreme fear — potential buying opportunity';
  if (value < 45) return 'Fear — caution but potential upside';
  if (value < 55) return 'Neutral sentiment';
  if (value < 75) return 'Greed — some caution warranted';
  return 'Extreme greed — take profit risk elevated';
}

export function StatsPanel({ coins, globalData }: StatsPanelProps) {
  const { data, loading, error, refetch } = useFearGreed();

  const totalMarketCap = globalData?.total_market_cap?.usd || 0;
  const totalVolume = globalData?.total_volume?.usd || 0;
  const btcDom = globalData?.market_cap_percentage?.btc || 0;
  const ethDom = globalData?.market_cap_percentage?.eth || 0;
  const marketChange = globalData?.market_cap_change_percentage_24h_usd || 0;

  const topCoins = coins.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Fear & Greed Index */}
      <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-text-primary text-sm font-semibold">Fear & Greed Index</h3>
            <p className="text-text-secondary text-xs mt-0.5">Crypto Market Sentiment</p>
          </div>
          <button
            onClick={refetch}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-text-secondary text-xs mb-1">Failed to load</p>
            <button onClick={refetch} className="text-xs text-accent hover:underline">Try again</button>
          </div>
        ) : data ? (
          <div className="flex flex-col items-center">
            <FearGreedGauge value={data.value} classification={data.classification} />

            {/* Scale */}
            <div className="w-full mt-3">
              <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                <span>Extreme Fear</span>
                <span>Neutral</span>
                <span>Extreme Greed</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex">
                <div className="w-[25%] bg-[#f85149]" />
                <div className="w-[20%] bg-[#f0883e]" />
                <div className="w-[10%] bg-[#d29922]" />
                <div className="w-[20%] bg-[#3fb950]" />
                <div className="w-[25%] bg-[#2ea043]" />
              </div>
            </div>

            {/* Interpretation */}
            <p className="text-text-secondary text-xs mt-2 text-center">{getFgInterpretation(data.value)}</p>
          </div>
        ) : null}
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-primary rounded-lg p-3 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">Market Cap</p>
          <p className="font-mono text-sm font-bold text-text-primary">
            ${totalMarketCap > 1e12 ? `${(totalMarketCap / 1e12).toFixed(2)}T` : `${(totalMarketCap / 1e9).toFixed(0)}B`}
          </p>
        </div>
        <div className="bg-bg-primary rounded-lg p-3 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">24h Volume</p>
          <p className="font-mono text-sm font-bold text-text-primary">
            ${totalVolume > 1e12 ? `${(totalVolume / 1e12).toFixed(2)}T` : `${(totalVolume / 1e9).toFixed(0)}B`}
          </p>
        </div>
        <div className="bg-bg-primary rounded-lg p-3 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">Market Change</p>
          <p className={`font-mono text-sm font-bold ${marketChange >= 0 ? 'text-gain' : 'text-loss'}`}>
            {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Market Dominance */}
      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Market Dominance</h3>
        <div className="flex items-center gap-6">
          <div className="relative" style={{ width: 100, height: 100 }}>
            <svg viewBox="0 0 42 42" className="w-full h-full">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#30363d" strokeWidth="4" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f7931a" strokeWidth="4"
                strokeDasharray={`${btcDom} ${100 - btcDom}`} strokeDashoffset="25" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#627eea" strokeWidth="4"
                strokeDasharray={`${ethDom} ${100 - ethDom}`} strokeDashoffset={`${25 - btcDom}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-text-primary">{btcDom.toFixed(0)}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f7931a]" />
              <span className="text-text-secondary text-xs">BTC {btcDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#627eea]" />
              <span className="text-text-secondary text-xs">ETH {ethDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#30363d]" />
              <span className="text-text-secondary text-xs">Other {(100 - btcDom - ethDom).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top by Market Cap */}
      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Top by Market Cap</h3>
        <div className="space-y-2">
          {topCoins.map((coin, i) => (
            <div key={coin.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-xs w-4">{i + 1}</span>
                <img src={coin.image} alt={coin.name} className="w-5 h-5 rounded-full" />
                <span className="text-text-primary text-sm">{coin.name}</span>
                <span className="text-text-secondary text-xs font-mono">#{coin.market_cap_rank}</span>
              </div>
              <span className="font-mono text-sm text-text-primary">${(coin.market_cap / 1e9).toFixed(1)}B</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
