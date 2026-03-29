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
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Fear & Greed Index */}
      <div className="bg-bg-primary rounded-lg p-3 border border-border-subtle flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-text-primary text-xs font-semibold">Fear & Greed</h3>
          <button
            onClick={refetch}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-3">
            <div className="w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-3">
            <p className="text-text-secondary text-xs mb-1">Failed to load</p>
            <button onClick={refetch} className="text-xs text-accent hover:underline">Retry</button>
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-3 flex-1">
              <FearGreedGauge value={data.value} classification={data.classification} />
              <div className="flex-1 min-w-0">
                <p className="text-text-secondary text-[10px] leading-tight">{getFgInterpretation(data.value)}</p>
                {/* Inline scale bar */}
                <div className="mt-2 h-1.5 rounded-full overflow-hidden flex">
                  <div className="w-[25%] bg-[#f85149]" />
                  <div className="w-[20%] bg-[#f0883e]" />
                  <div className="w-[10%] bg-[#d29922]" />
                  <div className="w-[20%] bg-[#3fb950]" />
                  <div className="w-[25%] bg-[#2ea043]" />
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Market Overview + Market Dominance */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Market Overview */}
        <div className="grid grid-cols-3 gap-2 flex-1">
          <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle flex flex-col justify-center">
            <p className="text-text-secondary text-[10px] mb-0.5">Market Cap</p>
            <p className="font-mono text-xs font-bold text-text-primary leading-tight">
              ${totalMarketCap > 1e12 ? `${(totalMarketCap / 1e12).toFixed(2)}T` : `${(totalMarketCap / 1e9).toFixed(0)}B`}
            </p>
          </div>
          <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle flex flex-col justify-center">
            <p className="text-text-secondary text-[10px] mb-0.5">24h Volume</p>
            <p className="font-mono text-xs font-bold text-text-primary leading-tight">
              ${totalVolume > 1e12 ? `${(totalVolume / 1e12).toFixed(2)}T` : `${(totalVolume / 1e9).toFixed(0)}B`}
            </p>
          </div>
          <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle flex flex-col justify-center">
            <p className="text-text-secondary text-[10px] mb-0.5">Change 24h</p>
            <p className={`font-mono text-xs font-bold leading-tight ${marketChange >= 0 ? 'text-gain' : 'text-loss'}`}>
              {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Market Dominance */}
        <div className="bg-bg-primary rounded-lg p-2 border border-border-subtle flex items-center gap-2 flex-1">
          <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
            <svg viewBox="0 0 42 42" className="w-full h-full">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#30363d" strokeWidth="4" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f7931a" strokeWidth="4"
                strokeDasharray={`${btcDom} ${100 - btcDom}`} strokeDashoffset="25" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#627eea" strokeWidth="4"
                strokeDasharray={`${ethDom} ${100 - ethDom}`} strokeDashoffset={`${25 - btcDom}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-[9px] font-bold text-text-primary">{btcDom.toFixed(0)}%</span>
            </div>
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#f7931a] shrink-0" />
              <span className="text-text-secondary text-[10px]">BTC</span>
              <span className="font-mono text-[10px] font-semibold text-text-primary ml-auto">{btcDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#627eea] shrink-0" />
              <span className="text-text-secondary text-[10px]">ETH</span>
              <span className="font-mono text-[10px] font-semibold text-text-primary ml-auto">{ethDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#30363d] shrink-0" />
              <span className="text-text-secondary text-[10px]">Other</span>
              <span className="font-mono text-[10px] font-semibold text-text-primary ml-auto">{(100 - btcDom - ethDom).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top by Market Cap */}
      <div className="bg-bg-primary rounded-lg p-3 border border-border-subtle flex flex-col min-w-0">
        <h3 className="text-text-secondary text-[10px] font-semibold uppercase tracking-wider mb-2">Top by Market Cap</h3>
        <div className="space-y-1.5 flex-1 overflow-hidden">
          {topCoins.map((coin, i) => (
            <div key={coin.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-text-secondary text-[10px] w-3 shrink-0">{i + 1}</span>
                <img src={coin.image} alt={coin.name} className="w-4 h-4 rounded-full shrink-0" />
                <span className="text-text-primary text-xs truncate">{coin.symbol.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-mono ${coin.price_change_percentage_24h >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(1)}%
                </span>
                <span className="font-mono text-xs text-text-primary">${(coin.market_cap / 1e9).toFixed(0)}B</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
