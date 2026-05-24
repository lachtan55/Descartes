import { TradingSignal, PriceBar, BacktestStats, TradeResult, BacktestConfig } from '../types';
import { getExpiryDate } from './expiry';

// Find the index of the first bar on or after the given date string (YYYY-MM-DD)
function findBarOnOrAfter(bars: PriceBar[], date: string): number {
  const target = date.slice(0, 10);
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].time >= target) return i;
  }
  return -1;
}

// Find the index of the last bar on or before the given date (inclusive)
function findBarOnOrBefore(bars: PriceBar[], date: string): number {
  const target = date.slice(0, 10);
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].time <= target) return i;
  }
  return -1;
}

function calcPnlPct(entry: number, exit: number, direction: 'LONG' | 'SHORT'): number {
  const raw = (exit - entry) / entry * 100;
  return direction === 'LONG' ? raw : -raw;
}

function calcR(pnlPct: number, stopPct: number | undefined): number | undefined {
  if (stopPct === undefined || stopPct === 0) return undefined;
  return pnlPct / stopPct;
}

function simulateTrade(signal: TradingSignal, bars: PriceBar[], _config: BacktestConfig): TradeResult | null {
  const dir = signal.direction;
  const tp = signal.take_profit;
  const sl = signal.stop_loss;

  // ── Step 1: Find entry bar ──────────────────────────────────────────────
  const searchStart = findBarOnOrAfter(bars, signal.created_at);
  if (searchStart === -1) return null; // signal date is beyond data range

  // ── Step 2: Determine close horizon (holdUntil → or last dataset bar) ──
  // getExpiryDate returns holdUntil if set, otherwise the last bar's date.
  const expiryDate = getExpiryDate(signal, bars);
  let expiryIdx: number;
  if (expiryDate) {
    const idx = findBarOnOrBefore(bars, expiryDate);
    expiryIdx = idx !== -1 ? idx : bars.length - 1;
  } else {
    expiryIdx = bars.length - 1;
  }

  // Signal starts after its own expiry — nothing to simulate
  if (searchStart > expiryIdx) return null;

  let fillIdx = -1;
  let actualEntry = 0;

  if (signal.entry_type === 'market') {
    fillIdx = searchStart;
    actualEntry = bars[fillIdx].open;
  } else {
    // Limit order: scan forward until price touches entry_price,
    // but never past the expiry horizon.
    const limitPrice = signal.entry_price;
    for (let i = searchStart; i <= expiryIdx; i++) {
      const bar = bars[i];
      const touched = dir === 'LONG'
        ? bar.low <= limitPrice
        : bar.high >= limitPrice;
      if (touched) {
        fillIdx = i;
        actualEntry = limitPrice;
        break;
      }
    }
    if (fillIdx === -1) {
      return {
        signal: { ...signal, status: 'unfilled' },
        entry_date: bars[searchStart].time,
        actual_entry_price: 0,
        pnl_pct: 0,
        status: 'unfilled',
        days_held: 0,
      };
    }
  }

  // Never close before the fill bar
  const maxClose = Math.max(fillIdx, expiryIdx);

  const riskPct = sl !== undefined
    ? Math.abs(calcPnlPct(actualEntry, sl, dir))
    : undefined;

  // ── Step 3: Simulate forward from the bar AFTER fill ─────────────────
  for (let i = fillIdx + 1; i <= maxClose; i++) {
    const bar = bars[i];

    const hitTP = dir === 'LONG' ? bar.high >= tp  : bar.low  <= tp;
    const hitSL = sl !== undefined && (dir === 'LONG' ? bar.low <= sl : bar.high >= sl);

    if (hitSL && hitTP) {
      const pnl = calcPnlPct(actualEntry, sl!, dir);
      return {
        signal: { ...signal, status: 'closed_loss', close_price: sl, close_date: bar.time, pnl_pct: pnl, actual_entry_price: actualEntry },
        entry_date: bars[fillIdx].time,
        actual_entry_price: actualEntry,
        close_date: bar.time,
        close_price: sl!,
        pnl_pct: pnl,
        r_multiple: calcR(pnl, riskPct),
        status: 'closed_loss',
        days_held: i - fillIdx,
      };
    }

    if (hitTP) {
      const pnl = calcPnlPct(actualEntry, tp, dir);
      return {
        signal: { ...signal, status: 'closed_win', close_price: tp, close_date: bar.time, pnl_pct: pnl, actual_entry_price: actualEntry },
        entry_date: bars[fillIdx].time,
        actual_entry_price: actualEntry,
        close_date: bar.time,
        close_price: tp,
        pnl_pct: pnl,
        r_multiple: calcR(pnl, riskPct),
        status: 'closed_win',
        days_held: i - fillIdx,
      };
    }

    if (hitSL) {
      const pnl = calcPnlPct(actualEntry, sl!, dir);
      return {
        signal: { ...signal, status: 'closed_loss', close_price: sl!, close_date: bar.time, pnl_pct: pnl, actual_entry_price: actualEntry },
        entry_date: bars[fillIdx].time,
        actual_entry_price: actualEntry,
        close_date: bar.time,
        close_price: sl!,
        pnl_pct: pnl,
        r_multiple: calcR(pnl, riskPct),
        status: 'closed_loss',
        days_held: i - fillIdx,
      };
    }
  }

  // ── Step 4: Expired — close at last bar in the horizon ────────────────
  const lastBar = bars[maxClose];
  const pnl = calcPnlPct(actualEntry, lastBar.close, dir);
  return {
    signal: { ...signal, status: 'expired', close_price: lastBar.close, close_date: lastBar.time, pnl_pct: pnl, actual_entry_price: actualEntry },
    entry_date: bars[fillIdx].time,
    actual_entry_price: actualEntry,
    close_date: lastBar.time,
    close_price: lastBar.close,
    pnl_pct: pnl,
    r_multiple: calcR(pnl, riskPct),
    status: 'expired',
    days_held: maxClose - fillIdx,
  };
}

function calcMaxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 100;
  let maxDD = 0;
  for (const e of equity) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(252);
}

export function runBacktest(
  signals: TradingSignal[],
  priceDataMap: Record<string, PriceBar[]>,
  config: BacktestConfig
): BacktestStats & { missing: string[]; unfilled: string[]; unfilledIds: string[] } {
  const trades: TradeResult[] = [];
  const missing: string[] = [];
  const unfilled: string[] = [];
  const unfilledIds: string[] = [];

  for (const signal of signals) {
    // Try original asset key, then fall back to case-insensitive lookup
    let bars = priceDataMap[signal.asset];
    if (!bars || bars.length === 0) {
      const upperKey = Object.keys(priceDataMap).find(
        k => k.toUpperCase() === signal.asset.toUpperCase()
      );
      if (upperKey) bars = priceDataMap[upperKey];
    }

    if (!bars || bars.length === 0) {
      missing.push(`${signal.asset} (no data)`);
      continue;
    }
    const result = simulateTrade(signal, bars, config);
    if (!result) {
      missing.push(`${signal.asset} (date out of range)`);
    } else if (result.status === 'unfilled') {
      unfilled.push(`${signal.asset} @ ${signal.entry_price} (limit never touched)`);
      unfilledIds.push(signal.id);
    } else {
      trades.push(result);
    }
  }

  if (trades.length === 0) {
    return {
      total_trades: 0, win_rate: 0, avg_pnl_pct: 0, avg_r_multiple: 0,
      expectancy: 0, profit_factor: 0, max_drawdown_pct: 0, sharpe_ratio: 0,
      total_return_pct: 0, equity_curve: [], trades: [], missing, unfilled, unfilledIds,
    };
  }

  const wins = trades.filter(t => t.status === 'closed_win');
  const losses = trades.filter(t => t.status !== 'closed_win');
  const win_rate = wins.length / trades.length * 100;
  const avg_pnl_pct = trades.reduce((a, t) => a + t.pnl_pct, 0) / trades.length;

  const rTrades = trades.filter(t => t.r_multiple !== undefined);
  const avg_r_multiple = rTrades.length > 0
    ? rTrades.reduce((a, t) => a + t.r_multiple!, 0) / rTrades.length
    : NaN;

  const gross_profit = wins.reduce((a, t) => a + t.pnl_pct, 0);
  const gross_loss = Math.abs(losses.reduce((a, t) => a + t.pnl_pct, 0));
  const profit_factor = gross_loss > 0 ? gross_profit / gross_loss : Infinity;

  const avg_win = wins.length > 0 ? gross_profit / wins.length : 0;
  const avg_loss = losses.length > 0 ? gross_loss / losses.length : 0;
  const expectancy = (win_rate / 100) * avg_win - ((100 - win_rate) / 100) * avg_loss;

  const sorted = [...trades].sort((a, b) => (a.close_date ?? '').localeCompare(b.close_date ?? ''));
  let equity = 100;
  const equity_curve = sorted.map(t => {
    equity = equity * (1 + t.pnl_pct / 100);
    return { date: t.close_date ?? t.entry_date, equity: parseFloat(equity.toFixed(2)) };
  });

  const equityValues = [100, ...equity_curve.map(e => e.equity)];
  const max_drawdown_pct = calcMaxDrawdown(equityValues);
  const sharpe_ratio = calcSharpe(sorted.map(t => t.pnl_pct));
  const total_return_pct = equity - 100;

  return {
    total_trades: trades.length, win_rate, avg_pnl_pct, avg_r_multiple,
    expectancy, profit_factor, max_drawdown_pct, sharpe_ratio,
    total_return_pct, equity_curve, trades, missing, unfilled, unfilledIds,
  };
}
