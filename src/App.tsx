import { useState, useEffect, useCallback } from 'react';
import { CoinProvider, useCoin } from './context/CoinContext';
import { useWatchlist } from './hooks/useWatchlist';
import { useAlerts } from './hooks/useAlerts';
import { Header } from './components/Header';
import { Watchlist } from './components/Watchlist';
import { CandlestickChart } from './components/CandlestickChart';
import { TabPanel } from './components/TabPanel';
import { StatsPanel } from './components/StatsPanel';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { NewsPanel } from './components/NewsPanel';
import { AlertModal } from './components/AlertModal';
import { Toast } from './components/Toast';
import { getMarketCoins, getGlobalData, searchCoins } from './lib/coingecko';
import type { CoinMarket, GlobalData } from './lib/coingecko';

function Dashboard() {
  const { selectedCoinId, setSelectedCoinId } = useCoin();
  const { favorites, toggleFavorite } = useWatchlist();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [coins, setCoins] = useState<CoinMarket[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData['data'] | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; symbol: string; thumb: string }>>([]);
  const [alertModalCoin, setAlertModalCoin] = useState<CoinMarket | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMarketCoins(1, 50), getGlobalData()])
      .then(([coinsData, global]) => {
        setCoins(coinsData);
        setGlobalData(global.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      searchCoins(searchQuery).then(r => setSearchResults(r.coins.slice(0, 8))).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!coins.length) return;
    const checkAlerts = setInterval(() => {
      alerts.forEach(alert => {
        if (alert.triggered) return;
        const coin = coins.find(c => c.id === alert.coinId);
        if (!coin) return;
        const triggered = alert.condition === 'above'
          ? coin.current_price >= alert.price
          : coin.current_price <= alert.price;
        if (triggered) {
          setToast(`${alert.coinName} is now ${alert.condition} $${alert.price}!`);
        }
      });
    }, 10000);
    return () => clearInterval(checkAlerts);
  }, [coins, alerts]);

  const handleSelectCoin = useCallback((id: string) => {
    setSelectedCoinId(id);
    setSearchQuery('');
    setSearchResults([]);
  }, [setSelectedCoinId]);

  const selectedCoin = coins.find(c => c.id === selectedCoinId);
  const btcCoin = coins.find(c => c.id === 'bitcoin');
  const ethCoin = coins.find(c => c.id === 'ethereum');

  const tabs = [
    { id: 'stats', label: 'Stats', component: <StatsPanel coins={coins} globalData={globalData} /> },
    { id: 'indicators', label: 'Indicators', component: <IndicatorsPanel /> },
    { id: 'news', label: 'News', component: <NewsPanel /> },
  ];

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <Header
        btcPrice={btcCoin?.current_price}
        btcChange={btcCoin?.price_change_percentage_24h}
        ethPrice={ethCoin?.current_price}
        ethChange={ethCoin?.price_change_percentage_24h}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectCoin={handleSelectCoin}
      />

      <div className="flex flex-1 overflow-hidden">
        <Watchlist
          coins={coins}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSetAlert={setAlertModalCoin}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <CandlestickChart key={selectedCoinId} />
          </div>

          {selectedCoin && (
            <div className="h-32 shrink-0 border-t border-border-subtle bg-bg-surface">
              <TabPanel tabs={tabs} />
            </div>
          )}
        </div>
      </div>

      {alertModalCoin && (
        <AlertModal
          coinName={alertModalCoin.id}
          coinSymbol={alertModalCoin.symbol}
          currentPrice={alertModalCoin.current_price}
          onSave={addAlert}
          onClose={() => setAlertModalCoin(null)}
          existingAlerts={alerts.filter(a => a.coinId === alertModalCoin.id)}
          onRemove={removeAlert}
        />
      )}

      {toast && (
        <Toast message={toast} type="alert" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <CoinProvider>
      <Dashboard />
    </CoinProvider>
  );
}
