import { createContext, useContext, useState } from 'react';

interface CoinContextType {
  selectedCoinId: string;
  setSelectedCoinId: (id: string) => void;
}

const CoinContext = createContext<CoinContextType>({
  selectedCoinId: 'bitcoin',
  setSelectedCoinId: () => {},
});

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const [selectedCoinId, setSelectedCoinId] = useState('bitcoin');
  return (
    <CoinContext.Provider value={{ selectedCoinId, setSelectedCoinId }}>
      {children}
    </CoinContext.Provider>
  );
}

export const useCoin = () => useContext(CoinContext);
