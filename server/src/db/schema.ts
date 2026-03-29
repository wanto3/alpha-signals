import Database from 'better-sqlite3';

export interface PriceRow {
  id?: number;
  symbol: string;
  price: number;
  timestamp: number;
}

export interface CandleRow {
  id?: number;
  symbol: string;
  interval: string;
  open_time: number;
  close_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quote_volume: number;
  is_closed: number;
  timestamp: number;
}

export interface IndicatorRow {
  id?: number;
  symbol: string;
  interval: string;
  timestamp: number;
  rsi_14: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  sma_20: number | null;
  ema_12: number | null;
  ema_26: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  atr_14: number | null;
  vwap: number | null;
}

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      UNIQUE(symbol, timestamp)
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

    CREATE INDEX IF NOT EXISTS idx_prices_symbol ON prices(symbol);
    CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp);
    CREATE INDEX IF NOT EXISTS idx_candles_symbol_interval ON candles(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
    CREATE INDEX IF NOT EXISTS idx_indicators_symbol_interval ON indicators(symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_indicators_timestamp ON indicators(timestamp);
  `);
}
