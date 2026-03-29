import type { SentimentType } from './useCryptoNews';

export type SignalStrength = 'bullish' | 'bearish' | 'neutral';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SignalOutput {
  signal: 'buy' | 'sell' | 'hold';
  score: number; // 0-10
  reasons: string[];
  confidence: ConfidenceLevel;
}

export interface SignalInput {
  rsi: number; // 0-100
  macd: SignalStrength;
  trend: SignalStrength;
  priceChange24h: number; // percent
  newsSentiment: SentimentType;
  newsCount: number; // number of relevant headlines
}

export function synthesizeSignal(input: SignalInput): SignalOutput {
  let score = 5; // neutral baseline
  const reasons: string[] = [];

  // RSI scoring
  if (input.rsi < 30) {
    score += 2;
    reasons.push('RSI oversold — reversal likely');
  } else if (input.rsi > 70) {
    score -= 2;
    reasons.push('RSI overbought — correction risk');
  }

  // MACD scoring
  if (input.macd === 'bullish') {
    score += 1.5;
    reasons.push('MACD bullish crossover');
  } else if (input.macd === 'bearish') {
    score -= 1.5;
    reasons.push('MACD bearish crossover');
  }

  // Trend scoring
  if (input.trend === 'bullish') {
    score += 1;
    reasons.push('Price in uptrend');
  } else if (input.trend === 'bearish') {
    score -= 1;
    reasons.push('Price in downtrend');
  }

  // News scoring
  if (input.newsSentiment === 'positive' && input.newsCount >= 3) {
    score += 1.5;
    reasons.push(`${input.newsCount} bullish headlines`);
  } else if (input.newsSentiment === 'negative' && input.newsCount >= 3) {
    score -= 1.5;
    reasons.push(`${input.newsCount} bearish headlines`);
  } else if (input.newsSentiment === 'positive' && input.newsCount >= 1) {
    score += 0.5;
    reasons.push('Bullish news sentiment');
  } else if (input.newsSentiment === 'negative' && input.newsCount >= 1) {
    score -= 0.5;
    reasons.push('Bearish news sentiment');
  }

  // 24h momentum scoring
  if (input.priceChange24h > 5) {
    score += 1;
    reasons.push('Strong 24h momentum (+' + input.priceChange24h.toFixed(1) + '%)');
  } else if (input.priceChange24h > 2) {
    score += 0.5;
    reasons.push('Positive 24h momentum');
  } else if (input.priceChange24h < -5) {
    score -= 1;
    reasons.push('Weak 24h momentum (' + input.priceChange24h.toFixed(1) + '%)');
  } else if (input.priceChange24h < -2) {
    score -= 0.5;
    reasons.push('Negative 24h momentum');
  }

  // Clamp and determine signal
  score = Math.max(0, Math.min(10, score));
  const signal: SignalOutput['signal'] =
    score >= 7 ? 'buy' : score <= 3 ? 'sell' : 'hold';

  const confidence: ConfidenceLevel =
    reasons.length >= 4 ? 'high' : reasons.length >= 2 ? 'medium' : 'low';

  return { signal, score, reasons, confidence };
}

export function rsiToStrength(rsi: number): SignalStrength {
  if (rsi < 30) return 'bullish';
  if (rsi > 70) return 'bearish';
  return 'neutral';
}

export function macdValueToStrength(
  macd: number,
  signal: number
): SignalStrength {
  const diff = macd - signal;
  if (diff > 0.001) return 'bullish';
  if (diff < -0.001) return 'bearish';
  return 'neutral';
}
