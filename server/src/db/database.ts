import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/alpha_signals.db');

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'crypto',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id),
      price REAL NOT NULL,
      volume_24h REAL,
      change_24h REAL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER REFERENCES assets(id),
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      conviction TEXT NOT NULL CHECK (conviction IN ('low', 'medium', 'high')),
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      open_time INTEGER NOT NULL,
      close_time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      quote_volume REAL NOT NULL,
      is_closed INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      rsi_14 REAL,
      macd_line REAL,
      macd_signal REAL,
      macd_histogram REAL,
      bb_upper REAL,
      bb_middle REAL,
      bb_lower REAL,
      sma_20 REAL,
      ema_12 REAL,
      ema_26 REAL,
      stoch_k REAL,
      stoch_d REAL,
      atr_14 REAL,
      vwap REAL
    );

    CREATE INDEX IF NOT EXISTS idx_prices_asset_id ON prices(asset_id);
    CREATE INDEX IF NOT EXISTS idx_prices_recorded_at ON prices(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_signals_asset_id ON signals(asset_id);
    CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
    CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval ON candles(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
    CREATE INDEX IF NOT EXISTS idx_indicators_symbol_interval ON indicators(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_indicators_timestamp ON indicators(timestamp);
  `);

  // Migration: add stoch/ATR/VWAP columns if they don't exist (for existing databases)
  const addColumns = [
    ['stoch_k', 'REAL'],
    ['stoch_d', 'REAL'],
    ['atr_14', 'REAL'],
    ['vwap', 'REAL'],
  ];
  for (const [col, type] of addColumns) {
    try {
      db.exec(`ALTER TABLE indicators ADD COLUMN ${col} ${type}`);
    } catch (_err) {
      // Column already exists — safe to ignore
    }
  }

  // Seed some initial assets if the table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM assets').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO assets (symbol, name, type) VALUES (?, ?, ?)'
    );
    const seedAssets = [
      ['BTC', 'Bitcoin', 'crypto'],
      ['ETH', 'Ethereum', 'crypto'],
      ['SOL', 'Solana', 'crypto'],
      ['DOGE', 'Dogecoin', 'crypto'],
      ['XRP', 'Ripple', 'crypto'],
      ['LINK', 'Chainlink', 'crypto'],
      ['ADA', 'Cardano', 'crypto'],
      ['ARB', 'Arbitrum', 'crypto'],
      ['MATIC', 'Polygon', 'crypto'],
      ['AVAX', 'Avalanche', 'crypto'],
      ['DOT', 'Polkadot', 'crypto'],
      ['UNI', 'Uniswap', 'crypto'],
      ['OP', 'Optimism', 'crypto'],
      ['NEAR', 'NEAR Protocol', 'crypto'],
      ['INJ', 'Injective', 'crypto'],
      ['TIA', 'Celestia', 'crypto'],
      ['SEI', 'Sei', 'crypto'],
      ['WLD', 'Worldcoin', 'crypto'],
      ['JUP', 'Jupiter', 'crypto'],
      ['PYTH', 'Pyth Network', 'crypto'],
    ];
    const insertMany = db.transaction(() => {
      for (const [symbol, name, type] of seedAssets) {
        insert.run(symbol, name, type);
      }
    });
    insertMany();
  }
}
