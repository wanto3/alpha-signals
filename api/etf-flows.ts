import type { VercelRequest, VercelResponse } from '@vercel/node';

// Major US spot Bitcoin ETFs (institutional grade)
const BTC_ETF_TICKERS = ['IBIT', 'FBTC', 'GBTC', 'ARKB', 'BITB', 'EZBC'];
// Major US spot Ethereum ETFs
const ETH_ETF_TICKERS = ['ETHA', 'EETH', 'CETH'];

interface YfQuote {
  close: number[];
  volume: number[];
  timestamp: number[];
}

interface EtfDailyFlow {
  date: string;
  price: number;
  volume: number;
  flow: number; // estimated flow in USD
  direction: 'inflow' | 'outflow' | 'neutral';
}

interface EtfFlowResult {
  ticker: string;
  name: string;
  flows: EtfDailyFlow[];
  netFlow7d: number;
  avgVolume7d: number;
}

interface EtfFlowResponse {
  btc: {
    etfs: EtfFlowResult[];
    totalNetFlow7d: number;
    avgVolume7d: number;
    consecutiveInflowDays: number;
    latestPriceChange: number; // percent
  };
  eth: {
    etfs: EtfFlowResult[];
    totalNetFlow7d: number;
    avgVolume7d: number;
    consecutiveInflowDays: number;
    latestPriceChange: number;
  };
  timestamp: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split('T')[0];
}

function calcFlow(close: number, volume: number, prevClose: number): number {
  if (!prevClose) return 0;
  const priceChange = (close - prevClose) / prevClose;
  // Flow direction is same as price direction for spot ETFs
  // Volume * average price gives estimated dollar flow
  const avgPrice = (close + prevClose) / 2;
  return priceChange * volume * avgPrice;
}

async function fetchEtfData(ticker: string): Promise<EtfFlowResult | null> {
  const nameMap: Record<string, string> = {
    IBIT: 'iShares Bitcoin Trust',
    FBTC: 'Fidelity Wise Origin Bitcoin',
    GBTC: 'Grayscale Bitcoin Trust',
    ARKB: 'Ark 21Shares Bitcoin ETF',
    BITB: 'Bitwise Bitcoin ETF',
    EZBC: 'Franklin Bitcoin ETF',
    ETHA: 'iShares Ethereum Trust',
    EETH: 'Fidelity Ethereum Fund',
    CETH: 'Cath Ethereum Fund',
  };

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=7d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { chart: { result: Array<{ indicators: { quote: YfQuote[] } }> } };
    const result = data.chart.result?.[0];
    if (!result) return null;

    const q: YfQuote = result.indicators.quote[0];
    if (!q.close || q.close.length === 0) return null;

    const closes: number[] = [];
    const volumes: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < q.close.length; i++) {
      if (q.close[i] != null && q.volume[i] != null) {
        closes.push(q.close[i]);
        volumes.push(q.volume[i]);
        timestamps.push(q.timestamp[i]);
      }
    }

    if (closes.length < 2) return null;

    const flows: EtfDailyFlow[] = [];
    for (let i = 0; i < closes.length; i++) {
      const flow = calcFlow(closes[i], volumes[i], closes[i - 1] ?? closes[i]);
      flows.push({
        date: formatDate(timestamps[i]),
        price: closes[i],
        volume: volumes[i],
        flow,
        direction: flow > 0 ? 'inflow' : flow < 0 ? 'outflow' : 'neutral',
      });
    }

    const netFlow7d = flows.reduce((sum, f) => sum + f.flow, 0);
    const avgVolume7d = flows.reduce((sum, f) => sum + f.volume, 0) / flows.length;
    const latestPriceChange = closes.length >= 2
      ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
      : 0;

    return {
      ticker,
      name: nameMap[ticker] ?? ticker,
      flows,
      netFlow7d,
      avgVolume7d,
    };
  } catch {
    return null;
  }
}

function countConsecutiveInflows(flows: EtfDailyFlow[]): number {
  let count = 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if (flows[i].direction === 'inflow') count++;
    else break;
  }
  return count;
}

function sumConsecutiveInflows(flows: EtfDailyFlow[]): number {
  let count = 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if (flows[i].direction === 'inflow') count += flows[i].flow;
    else break;
  }
  return count;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Fetch all ETF data in parallel
  const btcPromises = BTC_ETF_TICKERS.map(t => fetchEtfData(t));
  const ethPromises = ETH_ETF_TICKERS.map(t => fetchEtfData(t));

  const [btcResults, ethResults] = await Promise.all([
    Promise.all(btcPromises),
    Promise.all(ethPromises),
  ]);

  const btcEtfs = btcResults.filter((r): r is EtfFlowResult => r !== null);
  const ethEtfs = ethResults.filter((r): r is EtfFlowResult => r !== null);

  // Aggregate BTC ETF flows
  const btcTotalNetFlow7d = btcEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
  const btcAvgVolume7d = btcEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(btcEtfs.length, 1);
  const btcConsecutive = btcEtfs.reduce((max, e) => Math.max(max, countConsecutiveInflows(e.flows)), 0);
  const btcLatestChange = btcEtfs.length > 0 && btcEtfs[0].flows.length >= 2
    ? ((btcEtfs[0].flows[btcEtfs[0].flows.length - 1].price - btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price)
       / btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price) * 100
    : 0;

  // Aggregate ETH ETF flows
  const ethTotalNetFlow7d = ethEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
  const ethAvgVolume7d = ethEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(ethEtfs.length, 1);
  const ethConsecutive = ethEtfs.reduce((max, e) => Math.max(max, countConsecutiveInflows(e.flows)), 0);
  const ethLatestChange = ethEtfs.length > 0 && ethEtfs[0].flows.length >= 2
    ? ((ethEtfs[0].flows[ethEtfs[0].flows.length - 1].price - ethEtfs[0].flows[ethEtfs[0].flows.length - 2].price)
       / ethEtfs[0].flows[ethEtfs[0].flows.length - 2].price) * 100
    : 0;

  // Get BTC price from CoinGecko for divergence calculation
  let btcPriceChange24h = 0;
  try {
    const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currency=usd&include_24hr_change=true', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (cgRes.ok) {
      const cgData = await cgRes.json() as Record<string, { usd_24h_change: number }>;
      btcPriceChange24h = cgData.bitcoin?.usd_24h_change ?? 0;
    }
  } catch {
    // use 0 on failure
  }

  const response: EtfFlowResponse = {
    btc: {
      etfs: btcEtfs,
      totalNetFlow7d: btcTotalNetFlow7d,
      avgVolume7d: btcAvgVolume7d,
      consecutiveInflowDays: btcConsecutive,
      latestPriceChange: btcLatestChange,
    },
    eth: {
      etfs: ethEtfs,
      totalNetFlow7d: ethTotalNetFlow7d,
      avgVolume7d: ethAvgVolume7d,
      consecutiveInflowDays: ethConsecutive,
      latestPriceChange: ethLatestChange,
    },
    timestamp: Date.now(),
  };

  // Attach BTC price change to response for divergence calculation
  (response as Record<string, unknown>).btcPriceChange24h = btcPriceChange24h;

  res.json({ data: response });
}
