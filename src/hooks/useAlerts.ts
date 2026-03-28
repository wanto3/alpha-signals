import { useState, useEffect } from 'react';

export interface PriceAlert {
  id: string;
  coinId: string;
  coinName: string;
  price: number;
  condition: 'above' | 'below';
  triggered: boolean;
}

const STORAGE_KEY = 'tradingos-alerts';

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  }, [alerts]);

  const addAlert = (alert: Omit<PriceAlert, 'id' | 'triggered'>) => {
    setAlerts(prev => [...prev, { ...alert, id: crypto.randomUUID(), triggered: false }]);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const triggerAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, triggered: true } : a));
  };

  return { alerts, addAlert, removeAlert, triggerAlert };
}
