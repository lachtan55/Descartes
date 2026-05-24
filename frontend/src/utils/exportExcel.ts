import * as XLSX from 'xlsx';
import { BacktestStats, TradeResult } from '../types';

function fmtNum(n: number | undefined, dp = 2): string {
  if (n === undefined || isNaN(n)) return 'N/A';
  return n.toFixed(dp);
}

export function exportBacktestToExcel(stats: BacktestStats & { missing?: string[] }): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Trades', stats.total_trades],
    ['Win Rate (%)', fmtNum(stats.win_rate)],
    ['Avg P&L (%)', fmtNum(stats.avg_pnl_pct)],
    ['Avg R-Multiple', fmtNum(stats.avg_r_multiple)],
    ['Expectancy', fmtNum(stats.expectancy)],
    ['Profit Factor', isFinite(stats.profit_factor) ? fmtNum(stats.profit_factor) : 'Inf'],
    ['Max Drawdown (%)', fmtNum(stats.max_drawdown_pct)],
    ['Sharpe Ratio', fmtNum(stats.sharpe_ratio)],
    ['Total Return (%)', fmtNum(stats.total_return_pct)],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Trades sheet
  const tradeHeaders = ['ASSET', 'DIR', 'ENTRY DATE', 'CLOSE DATE', 'ENTRY', 'CLOSE', 'P&L%', 'R', 'STATUS', 'DAYS'];
  const tradeRows = stats.trades.map((t: TradeResult) => [
    t.signal.asset,
    t.signal.direction,
    t.entry_date,
    t.close_date ?? '',
    fmtNum(t.signal.entry_price, 4),
    fmtNum(t.close_price, 4),
    fmtNum(t.pnl_pct),
    fmtNum(t.r_multiple),
    t.status,
    t.days_held,
  ]);
  const tradesWs = XLSX.utils.aoa_to_sheet([tradeHeaders, ...tradeRows]);
  XLSX.utils.book_append_sheet(wb, tradesWs, 'Trades');

  // Equity curve sheet
  const ecHeaders = ['Date', 'Equity'];
  const ecRows = stats.equity_curve.map(e => [e.date, e.equity]);
  const ecWs = XLSX.utils.aoa_to_sheet([ecHeaders, ...ecRows]);
  XLSX.utils.book_append_sheet(wb, ecWs, 'Equity Curve');

  XLSX.writeFile(wb, `backtest_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportFullReportToExcel(
  stats: BacktestStats,
  byAsset: { asset: string; win_rate: number; avg_pnl: number; count: number }[],
  byDirection: { direction: string; win_rate: number; avg_pnl: number; count: number }[],
  byMomentum: { momentum: string; win_rate: number; avg_pnl: number; count: number }[]
): void {
  const wb = XLSX.utils.book_new();

  // Summary
  const summaryData = [
    ['Metric', 'Value'],
    ['Total Trades', stats.total_trades],
    ['Win Rate (%)', fmtNum(stats.win_rate)],
    ['Avg P&L (%)', fmtNum(stats.avg_pnl_pct)],
    ['Avg R-Multiple', fmtNum(stats.avg_r_multiple)],
    ['Expectancy', fmtNum(stats.expectancy)],
    ['Profit Factor', isFinite(stats.profit_factor) ? fmtNum(stats.profit_factor) : 'Inf'],
    ['Max Drawdown (%)', fmtNum(stats.max_drawdown_pct)],
    ['Sharpe Ratio', fmtNum(stats.sharpe_ratio)],
    ['Total Return (%)', fmtNum(stats.total_return_pct)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

  // Trades
  const tradeHeaders = ['ASSET', 'DIR', 'ENTRY DATE', 'CLOSE DATE', 'ENTRY', 'CLOSE', 'P&L%', 'R', 'STATUS'];
  const tradeRows = stats.trades.map((t: TradeResult) => [
    t.signal.asset, t.signal.direction, t.entry_date, t.close_date ?? '',
    fmtNum(t.signal.entry_price, 4), fmtNum(t.close_price, 4),
    fmtNum(t.pnl_pct), fmtNum(t.r_multiple), t.status,
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tradeHeaders, ...tradeRows]), 'Trades');

  // By Asset
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.aoa_to_sheet([
      ['Asset', 'Win Rate %', 'Avg P&L %', 'Trades'],
      ...byAsset.map(r => [r.asset, fmtNum(r.win_rate), fmtNum(r.avg_pnl), r.count]),
    ]),
    'By Asset'
  );

  // By Direction
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.aoa_to_sheet([
      ['Direction', 'Win Rate %', 'Avg P&L %', 'Trades'],
      ...byDirection.map(r => [r.direction, fmtNum(r.win_rate), fmtNum(r.avg_pnl), r.count]),
    ]),
    'By Direction'
  );

  // By Momentum
  XLSX.utils.book_append_sheet(wb,
    XLSX.utils.aoa_to_sheet([
      ['Momentum', 'Win Rate %', 'Avg P&L %', 'Trades'],
      ...byMomentum.map(r => [r.momentum, fmtNum(r.win_rate), fmtNum(r.avg_pnl), r.count]),
    ]),
    'By Momentum'
  );

  XLSX.writeFile(wb, `analytics_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
