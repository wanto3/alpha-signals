import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tradingos-watchlist';

export function useWatchlist() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '["bitcoin","ethereum","solana","ripple","cardano"]');
    } catch { return ['bitcoin', 'ethereum', 'solana', 'ripple', 'cardano']; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return { favorites, toggleFavorite };
}
