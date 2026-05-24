import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { TradingSignal, TradeResult } from '../types';
import { exportFullReportToExcel } from '../utils/exportExcel';
import { formatPct } from '../utils/tickers';

interface Props {
  signals: TradingSignal[];
}

function buildTradeResults(signals: TradingSignal[]): TradeResult[] {
  return signals
    .filter(s =>
      ['closed_win', 'closed_loss', 'expired'].includes(s.status) &&
      s.pnl_pct != null && isFinite(s.pnl_pct)
    )
    .map(s => ({
      signal: s,
      entry_date: s.created_at.slice(0, 10),
      actual_entry_price: s.actual_entry_price ?? s.entry_price ?? 0,
      close_date: s.close_date,
      close_price: s.close_price,
      pnl_pct: s.pnl_pct!,
      r_multiple: s.r_multiple,
      status: s.status,
      days_held: s.close_date
        ? Math.max(0, Math.round((new Date(s.close_date).getTime() - new Date(s.created_at).getTime()) / 86400000))
        : 0,
    }));
}

function groupBy<T>(arr: T[], key: (t: T) => string) {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function calcStats(trades: TradeResult[]) {
  if (!trades.length) return { win_rate: 0, avg_pnl: 0, count: 0 };
  const wins = trades.filter(t => t.status === 'closed_win').length;
  const avg_pnl = trades.reduce((a, t) => a + t.pnl_pct, 0) / trades.length;
  return { win_rate: wins / trades.length * 100, avg_pnl, count: trades.length };
}

function buildEquityCurve(trades: TradeResult[]) {
  const sorted = [...trades].sort((a, b) => (a.close_date ?? '').localeCompare(b.close_date ?? ''));
  let equity = 100;
  return [{ date: 'Start', equity: 100 }, ...sorted.map(t => {
    equity = equity * (1 + t.pnl_pct / 100);
    return { date: t.close_date ?? t.entry_date, equity: parseFloat(equity.toFixed(2)) };
  })];
}

function buildDrawdownCurve(equityCurve: { date: string; equity: number }[]) {
  let peak = 100;
  return equityCurve.map(e => {
    if (e.equity > peak) peak = e.equity;
    return { date: e.date, drawdown: parseFloat((((peak - e.equity) / peak) * 100).toFixed(2)) };
  });
}

function KpiTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function AnalyticsTab({ signals }: Props) {
  const trades = buildTradeResults(signals);

  if (trades.length === 0) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
        NO CLOSED TRADES — Close signals manually or run a backtest to generate analytics.
      </div>
    );
  }

  const wins = trades.filter(t => t.status === 'closed_win');
  const losses = trades.filter(t => t.status !== 'closed_win');
  const win_rate = trades.length > 0 ? wins.length / trades.length * 100 : 0;
  const total_return = trades.reduce((a, t) => a + t.pnl_pct, 0);
  const avg_r = trades.filter(t => t.r_multiple !== undefined).reduce((a, t) => a + t.r_multiple!, 0) / (trades.filter(t => t.r_multiple !== undefined).length || 1);
  const avg_win = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl_pct, 0) / wins.length : 0;
  const avg_loss_abs = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl_pct, 0) / losses.length) : 0;
  const expectancy = (win_rate / 100) * avg_win - ((100 - win_rate) / 100) * avg_loss_abs;

  const equityCurve = buildEquityCurve(trades);
  const drawdown = buildDrawdownCurve(equityCurve);
  const maxDD = Math.max(...drawdown.map(d => d.drawdown));

  // P&L distribution histogram
  const pnlBins: Record<string, number> = {};
  for (const t of trades) {
    const bin = (Math.floor(t.pnl_pct / 2) * 2).toFixed(0);
    pnlBins[bin] = (pnlBins[bin] ?? 0) + 1;
  }
  const pnlDist = Object.entries(pnlBins).sort((a, b) => Number(a[0]) - Number(b[0])).map(([range, count]) => ({ range: range + '%', count }));

  // Breakdowns
  const byAssetMap = groupBy(trades, t => t.signal.asset);
  const byAsset = Object.entries(byAssetMap).map(([asset, ts]) => ({ asset, ...calcStats(ts) })).sort((a, b) => b.count - a.count);

  const byDirMap = groupBy(trades, t => t.signal.direction);
  const byDirection = Object.entries(byDirMap).map(([direction, ts]) => ({ direction, ...calcStats(ts) }));

  const byMomMap = groupBy(trades, t => `${t.signal.momentum_strength} ${t.signal.momentum_direction}`);
  const byMomentum = Object.entries(byMomMap).map(([momentum, ts]) => ({ momentum, ...calcStats(ts) }));

  const handleExport = () => exportFullReportToExcel(
    {
      total_trades: trades.length, win_rate, avg_pnl_pct: total_return / trades.length,
      avg_r_multiple: avg_r, expectancy, profit_factor: 0, max_drawdown_pct: maxDD,
      sharpe_ratio: 0, total_return_pct: total_return, equity_curve: equityCurve, trades,
    },
    byAsset,
    byDirection,
    byMomentum
  );

  return (
    <div className="analytics-tab">
      {/* Row 1: KPI tiles */}
      <div className="kpi-row">
        <KpiTile label="WIN RATE" value={win_rate.toFixed(1) + '%'} color={win_rate >= 50 ? 'var(--accent-green)' : 'var(--accent-red)'} />
        <KpiTile label="TOTAL RETURN" value={formatPct(total_return)} color={total_return >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} sub={`${trades.length} trades`} />
        <KpiTile label="AVG R:R" value={isNaN(avg_r) ? 'N/A' : avg_r.toFixed(2) + 'R'} />
        <KpiTile label="EXPECTANCY" value={formatPct(expectancy)} color={expectancy >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
        <KpiTile label="MAX DRAWDOWN" value={maxDD.toFixed(2) + '%'} color="var(--accent-red)" />
      </div>

      {/* Row 2: Charts */}
      <div className="chart-row">
        <div className="panel chart-panel">
          <div className="panel-title">EQUITY CURVE</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={equityCurve} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ecGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00c851" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00c851" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#555', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: 11 }} />
              <Area type="monotone" dataKey="equity" stroke="#00c851" fill="url(#ecGrad2)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">DRAWDOWN</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={drawdown} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff3d3d" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ff3d3d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#555', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: 11 }} />
              <Area type="monotone" dataKey="drawdown" stroke="#ff3d3d" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <div className="panel-title">P&L DISTRIBUTION</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pnlDist} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis dataKey="range" tick={{ fill: '#555', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: '#555', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontSize: 11 }} />
              <Bar dataKey="count" radius={[1, 1, 0, 0]}>
                {pnlDist.map((entry, i) => (
                  <Cell key={i} fill={parseFloat(entry.range) >= 0 ? '#00c851' : '#ff3d3d'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Breakdown tables */}
      <div className="breakdown-row">
        <div className="panel breakdown-panel">
          <div className="panel-title">BY ASSET</div>
          <table className="data-table">
            <thead><tr><th>ASSET</th><th>TRADES</th><th>WIN %</th><th>AVG P&L %</th></tr></thead>
            <tbody>
              {byAsset.map((r, i) => (
                <tr key={r.asset} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="mono bold">{r.asset}</td>
                  <td className="mono dim">{r.count}</td>
                  <td className={`mono ${r.win_rate >= 50 ? 'green' : 'red'}`}>{r.win_rate.toFixed(1)}%</td>
                  <td className={`mono ${r.avg_pnl >= 0 ? 'green' : 'red'}`}>{formatPct(r.avg_pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel breakdown-panel">
          <div className="panel-title">BY DIRECTION</div>
          <table className="data-table">
            <thead><tr><th>DIRECTION</th><th>TRADES</th><th>WIN %</th><th>AVG P&L %</th></tr></thead>
            <tbody>
              {byDirection.map((r, i) => (
                <tr key={r.direction} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className={`mono ${r.direction === 'LONG' ? 'green' : 'red'}`}>{r.direction}</td>
                  <td className="mono dim">{r.count}</td>
                  <td className={`mono ${r.win_rate >= 50 ? 'green' : 'red'}`}>{r.win_rate.toFixed(1)}%</td>
                  <td className={`mono ${r.avg_pnl >= 0 ? 'green' : 'red'}`}>{formatPct(r.avg_pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel breakdown-panel">
          <div className="panel-title">BY MOMENTUM</div>
          <table className="data-table">
            <thead><tr><th>MOMENTUM</th><th>TRADES</th><th>WIN %</th><th>AVG P&L %</th></tr></thead>
            <tbody>
              {byMomentum.map((r, i) => (
                <tr key={r.momentum} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="mono dim" style={{ textTransform: 'uppercase', fontSize: 11 }}>{r.momentum}</td>
                  <td className="mono dim">{r.count}</td>
                  <td className={`mono ${r.win_rate >= 50 ? 'green' : 'red'}`}>{r.win_rate.toFixed(1)}%</td>
                  <td className={`mono ${r.avg_pnl >= 0 ? 'green' : 'red'}`}>{formatPct(r.avg_pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <button className="btn-secondary" onClick={handleExport}>EXPORT FULL REPORT — XLSX</button>
      </div>
    </div>
  );
}
