import { Search, Clock, Wifi, TrendingUp, TrendingDown } from 'lucide-react';

interface HeaderProps {
  btcPrice?: number;
  btcChange?: number;
  ethPrice?: number;
  ethChange?: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: { id: string; name: string; symbol: string; thumb: string }[];
  onSelectCoin: (id: string) => void;
}

export function Header({
  btcPrice,
  btcChange,
  ethPrice,
  ethChange,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectCoin,
}: HeaderProps) {
  return (
    <header className="bg-dark-surface border-b border-dark-border px-4 md:px-6 py-3 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* BTC / ETH mini prices */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">BTC</span>
            <span className="text-gray-200">${btcPrice?.toLocaleString() ?? '—'}</span>
            {btcChange !== undefined && (
              <span className={btcChange >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {btcChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium">ETH</span>
            <span className="text-gray-200">${ethPrice?.toLocaleString() ?? '—'}</span>
            {ethChange !== undefined && (
              <span className={ethChange >= 0 ? 'text-signal-buy' : 'text-signal-sell'}>
                {ethChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden z-20">
              {searchResults.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectCoin(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-muted transition-colors"
                >
                  <img src={r.thumb} alt={r.symbol} className="w-5 h-5 rounded-full" />
                  <span className="text-gray-200 text-sm">{r.name}</span>
                  <span className="text-gray-500 text-xs uppercase">{r.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
            <Wifi size={12} className="text-signal-buy" />
            <span>Live</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} />
          </div>
        </div>
      </div>
    </header>
  );
}
