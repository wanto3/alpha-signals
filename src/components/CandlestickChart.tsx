import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts';
import { getOhlc } from '../lib/coingecko';
import { useCoin } from '../context/CoinContext';

const TIMEFRAMES = [
  { label: '1H', days: 1 },
  { label: '4H', days: 1 },
  { label: '1D', days: 7 },
  { label: '1W', days: 30 },
  { label: '1M', days: 90 },
];

export function CandlestickChart() {
  const { selectedCoinId, setSelectedCoinId } = useCoin();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: '#161b22' },
        textColor: '#8b949e',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#58a6ff', width: 1, style: 2 },
        horzLine: { color: '#58a6ff', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#30363d',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#58a6ff',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartApiRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartApiRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const rawData = await getOhlc(selectedCoinId, timeframe.days);
        const candleData: CandlestickData<Time>[] = rawData.map(d => ({
          time: (d.time / 1000) as Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));
        const volumeData: HistogramData<Time>[] = rawData.map(d => ({
          time: (d.time / 1000) as Time,
          value: 0,
          color: d.close >= d.open ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)',
        }));
        candleRef.current!.setData(candleData);
        volumeRef.current!.setData(volumeData);
        chartApiRef.current?.timeScale().fitContent();
      } catch (e) {
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCoinId, timeframe]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.label}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-colors ${
              timeframe.label === tf.label
                ? 'bg-accent text-bg-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-surface/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-text-secondary text-xs">Loading chart...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-loss text-sm mb-2">{error}</p>
              <button
                onClick={() => { if (candleRef.current) { const id = selectedCoinId; setSelectedCoinId(''); setTimeout(() => setSelectedCoinId(id), 0); } }}
                className="text-accent text-xs hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <div ref={chartRef} className="w-full h-full" />
      </div>
    </div>
  );
}
