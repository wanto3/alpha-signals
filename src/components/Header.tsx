import { Search, RefreshCw, Clock, Wifi } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function Header({ lastUpdated, onRefresh, isRefreshing }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="bg-dark-surface border-b border-dark-border px-4 md:px-6 py-4 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search assets, markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
            <Wifi size={12} className="text-signal-buy" />
            <span>Live</span>
          </div>

          {/* Last updated */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} />
            <span>Updated {lastUpdated}</span>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-dark-card border border-dark-border text-gray-400 hover:text-gray-200 hover:border-dark-muted transition-all disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </header>
  );
}
