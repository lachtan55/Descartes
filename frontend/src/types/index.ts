export type AssetType = 'equity' | 'futures_commodity' | 'etf' | 'crypto' | 'futures_index';
export type Direction = 'LONG' | 'SHORT';
export type MomentumStrength = 'STRONG' | 'WEAK';
export type MomentumDirection = 'UP' | 'DOWN';
export type SignalStatus = 'pending' | 'active' | 'closed_win' | 'closed_loss' | 'expired' | 'unfilled';
export type ParsedBy = 'manual' | 'rule_based' | 'ai';
export type EntryType = 'market' | 'limit';

export interface TradingSignal {
  id: string;
  created_at: string;          // ISO date — the intended entry date (YYYY-MM-DD)
  asset: string;
  asset_type: AssetType;
  direction: Direction;
  entry_type: EntryType;       // market = fills at open; limit = fills at entry_price
  entry_price: number;         // limit price; 0 for market (filled at open during backtest)
  actual_entry_price?: number; // set by backtest: open for market, limit_price for limit
  momentum_strength: MomentumStrength;
  momentum_direction: MomentumDirection;
  take_profit: number;         // target price (TP)
  stop_loss?: number;          // stop loss (SL), optional
  holdUntil?: string;        // ISO date — signal expires end-of-day on this date
  notes?: string;
  raw_text?: string;
  parsed_by: ParsedBy;
  status: SignalStatus;
  close_price?: number;
  close_date?: string;
  pnl_pct?: number;
  r_multiple?: number;
}

export interface PriceBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ParseResult {
  signal: Partial<TradingSignal>;
  confidence: number;
  flags: string[];
}

export interface BacktestConfig {
  use_ai_normalization: boolean;
  price_data_source: 'yfinance' | 'excel';
  start_date: string;
  end_date: string;
  assets: string[];
}

export interface TradeResult {
  signal: TradingSignal;
  entry_date: string;
  actual_entry_price: number;
  close_date?: string;
  close_price?: number;
  pnl_pct: number;
  r_multiple?: number;
  status: SignalStatus;
  days_held: number;
}

export interface BacktestStats {
  total_trades: number;
  win_rate: number;
  avg_pnl_pct: number;
  avg_r_multiple: number;
  expectancy: number;
  profit_factor: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  total_return_pct: number;
  equity_curve: { date: string; equity: number }[];
  trades: TradeResult[];
}

export interface StoredPriceData {
  ticker: string;
  bars: PriceBar[];
  last_updated: string;
  source: 'yfinance' | 'excel' | 'csv';
}
