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
      timestamp INTEGER NOT NULL,
      UNIQUE(symbol, interval, open_time)
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
      vwap REAL,
      UNIQUE(symbol, interval, timestamp)
    );

    CREATE TABLE IF NOT EXISTS indicator_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      candle_time INTEGER NOT NULL,
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
      vwap REAL,
      source TEXT NOT NULL DEFAULT 'computed'
    );

    CREATE INDEX IF NOT EXISTS idx_prices_asset_id ON prices(asset_id);
    CREATE INDEX IF NOT EXISTS idx_prices_recorded_at ON prices(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_signals_asset_id ON signals(asset_id);
    CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at);
    CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval ON candles(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
    CREATE INDEX IF NOT EXISTS idx_indicators_symbol_interval ON indicators(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_indicators_timestamp ON indicators(timestamp);
    CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_interval ON indicator_snapshots(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_snapshots_candle_time ON indicator_snapshots(candle_time);

    CREATE TABLE IF NOT EXISTS data_freshness (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_type TEXT NOT NULL,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      source TEXT NOT NULL,
      last_successful_fetch INTEGER NOT NULL,
      rows_updated INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      UNIQUE(feed_type, symbol, interval)
    );
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

  // Migration: add UNIQUE constraints for candles and indicators if not exist
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_unique ON candles(symbol, interval, open_time)`);
  } catch (_err) {
    // Index may already exist
  }
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_indicators_unique ON indicators(symbol, interval, timestamp)`);
  } catch (_err) {
    // Index may already exist
  }

  // Migration: create indicator_snapshots table if not exists
  // (already created above, but need to handle existing DBs that don't have it)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS indicator_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        candle_time INTEGER NOT NULL,
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
        vwap REAL,
        source TEXT NOT NULL DEFAULT 'computed'
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_interval ON indicator_snapshots(symbol, interval)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_candle_time ON indicator_snapshots(candle_time)`);
  } catch (_err) {
    // Table may already exist
  }

  // Migration: create data_freshness table if not exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_freshness (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        interval TEXT NOT NULL,
        source TEXT NOT NULL,
        last_successful_fetch INTEGER NOT NULL,
        rows_updated INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        UNIQUE(feed_type, symbol, interval)
      )
    `);
  } catch (_err) {
    // Table may already exist
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

/**
 * Record the freshness of a data feed.
 * @param feedType 'prices' | 'candles'
 * @param symbol The trading symbol (e.g. 'BTC')
 * @param interval The candle interval (e.g. '1h', '4h', '1d') or 'ticker' for prices
 * @param source The data source that succeeded ('binance', 'coinbase')
 * @param rowsUpdated Number of rows inserted/updated
 * @param error Optional error message if the fetch failed
 */
export function recordFreshness(
  feedType: string,
  symbol: string,
  interval: string,
  source: string,
  rowsUpdated: number,
  error?: string
): void {
  db.prepare(`
    INSERT OR REPLACE INTO data_freshness
      (feed_type, symbol, interval, source, last_successful_fetch, rows_updated, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(feedType, symbol, interval, source, Date.now(), rowsUpdated, error ?? null);
}
