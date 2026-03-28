import { useState } from 'react';
import { X, Bell, TrendingUp, TrendingDown } from 'lucide-react';
import type { PriceAlert } from '../hooks/useAlerts';

interface AlertModalProps {
  coinName: string;
  coinSymbol: string;
  currentPrice: number;
  onSave: (alert: Omit<PriceAlert, 'id' | 'triggered'>) => void;
  onClose: () => void;
  existingAlerts: PriceAlert[];
  onRemove: (id: string) => void;
}

export function AlertModal({ coinName, coinSymbol, currentPrice, onSave, onClose, existingAlerts, onRemove }: AlertModalProps) {
  const [price, setPrice] = useState(currentPrice.toString());
  const [condition, setCondition] = useState<'above' | 'below'>('above');

  const coinAlerts = existingAlerts.filter(a => a.coinId === coinName);

  const handleSave = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) return;
    onSave({ coinId: coinName, coinName: coinSymbol.toUpperCase(), price: p, condition });
    setPrice('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-alert" />
            <h2 className="text-text-primary font-semibold">Set Price Alert</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="bg-bg-primary rounded-lg p-3 mb-4 border border-border-subtle">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">{coinSymbol.toUpperCase()}</span>
            <span className="font-mono text-lg font-bold text-text-primary">${currentPrice.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCondition('above')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
              condition === 'above' ? 'border-gain bg-gain/10 text-gain' : 'border-border-subtle text-text-secondary'
            }`}
          >
            <TrendingUp size={16} />
            <span className="text-sm font-medium">Above</span>
          </button>
          <button
            onClick={() => setCondition('below')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
              condition === 'below' ? 'border-loss bg-loss/10 text-loss' : 'border-border-subtle text-text-secondary'
            }`}
          >
            <TrendingDown size={16} />
            <span className="text-sm font-medium">Below</span>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder={`Price (${currentPrice.toLocaleString()})`}
            className="flex-1 bg-bg-primary border border-border-subtle rounded-lg px-4 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-accent text-bg-primary rounded-lg font-semibold text-sm hover:bg-accent/90 transition-colors"
          >
            Set Alert
          </button>
        </div>

        {coinAlerts.length > 0 && (
          <div>
            <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Active Alerts</h3>
            <div className="space-y-2">
              {coinAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between bg-bg-primary rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${alert.condition === 'above' ? 'text-gain' : 'text-loss'}`}>
                      {alert.condition === 'above' ? '↑' : '↓'} ${alert.price.toLocaleString()}
                    </span>
                    {alert.triggered && (
                      <span className="text-xs text-alert font-semibold">TRIGGERED</span>
                    )}
                  </div>
                  <button onClick={() => onRemove(alert.id)} className="text-text-secondary hover:text-loss">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
