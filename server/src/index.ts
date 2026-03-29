import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './db/database.js';
import healthRoutes from './routes/health.js';
import assetsRoutes from './routes/assets.js';
import pricesRoutes from './routes/prices.js';
import candlesRoutes from './routes/candles.js';
import indicatorsRoutes from './routes/indicators.js';
import polymarketRoutes from './routes/polymarket.js';
import etfFlowsRoutes from './routes/etf-flows.js';
import fdvRatioRoutes from './routes/fdv-ratio.js';
import tokenUnlocksRoutes from './routes/token-unlocks.js';
import { startIngestionScheduler } from './services/ingestion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api', assetsRoutes);
app.use('/api', pricesRoutes);
app.use('/api', candlesRoutes);
app.use('/api', indicatorsRoutes);
app.use('/api', polymarketRoutes);
app.use('/api', etfFlowsRoutes);
app.use('/api', fdvRatioRoutes);
app.use('/api', tokenUnlocksRoutes);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`Alpha Signals server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Available endpoints:`);
  console.log(`  GET /api/prices            — all tracked asset prices`);
  console.log(`  GET /api/prices/:symbol    — latest price for symbol`);
  console.log(`  GET /api/candles/:symbol   — OHLCV candles (interval, limit params)`);
  console.log(`  GET /api/indicators/:symbol — computed RSI, MACD, BB, SMA, EMA`);
  console.log(`  GET /api/polymarket        — Polymarket prediction markets`);
  console.log(`  GET /api/etf-flows         — Bitcoin/Ethereum ETF flows`);
  console.log(`  GET /api/fdv-ratio         — FDV ratio analysis`);
  console.log(`  GET /api/token-unlocks     — upcoming token unlock schedules`);
  console.log();
  console.log(`Background ingestion: prices every 60s, candles every 5min`);

  // Start background data ingestion from Binance
  startIngestionScheduler();
});
