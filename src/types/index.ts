export type SignalType = 'buy' | 'sell' | 'hold';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Opportunity {
  id: string;
  asset: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  convictionScore: number; // 1-10
  signal: SignalType;
  market: string;
  reason: string;
  indicators: {
    rsi: number;
    macd: string;
    trend: string;
  };
  updatedAt: string;
}
