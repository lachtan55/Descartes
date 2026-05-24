import { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, Time, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TradingSignal, PriceBar, BacktestStats, BacktestConfig } from '../types';
import { runBacktest } from '../utils/backtestEngine';
import { loadPriceData, savePriceData, listStoredPriceDatasets } from '../utils/storage';
import { exportBacktestToExcel } from '../utils/exportExcel';
import { normalizeTickerForYF, formatPrice, formatPct, formatR } from '../utils/tickers';

interface Props {
  signals: TradingSignal[];
  onSignalsChange: (s: TradingSignal[]) => void;
}

const DEFAULT_CONFIG: BacktestConfig = {
  use_ai_normalization: false,
  price_data_source: 'yfinance',
  start_date: (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })(),
  end_date: new Date().toISOString().slice(0, 10),
  assets: [],   // always 0 or 1 items — single-select UI
};

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

export default function BacktestTab({ signals, onSignalsChange }: Props) {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<(BacktestStats & { missing?: string[]; unfilled?: string[]; unfilledIds?: string[] }) | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [chartAsset, setChartAsset] = useState('');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // All unique assets — signals + stored datasets (both are valid backtest targets)
  const signalAssets = [...new Set(signals.map(s => s.asset))];
  const storedTickers = listStoredPriceDatasets().map(d => d.ticker);
  // Union of stored datasets and signal assets, stored tickers listed first
  const selectableAssets = [...new Set([...storedTickers, ...signalAssets])];

  // Single selected asset — kept in sync between the config dropdown and the chart
  const selectedAsset = config.assets[0] ?? '';

  // Auto-select first available asset when list changes
  useEffect(() => {
    if (!selectedAsset && selectableAssets.length > 0) {
      const first = selectableAssets[0];
      setConfig(c => ({ ...c, assets: [first] }));
      setChartAsset(first);
    }
  }, [selectableAssets.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Keep chart in sync with the asset picker
  useEffect(() => {
    if (selectedAsset) setChartAsset(selectedAsset);
  }, [selectedAsset]);

  // Chart rendering — independent of backtest results
  useEffect(() => {
    if (!chartContainerRef.current || !chartAsset) return;

    const priceData = loadPriceData(chartAsset);
    if (!priceData || priceData.bars.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 600,
      height: 340,
      layout: { background: { color: '#141414' }, textColor: '#888' },
      grid: { vertLines: { color: '#1e1e1e' }, horzLines: { color: '#1e1e1e' } },
      crosshair: { vertLine: { color: '#f0a500' }, horzLine: { color: '#f0a500' } },
      timeScale: { borderColor: '#2a2a2a' },
      rightPriceScale: { borderColor: '#2a2a2a' },
    });
    chartRef.current = chart;

    if (chartType === 'candle') {
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#00c851', downColor: '#ff3d3d',
        borderUpColor: '#00c851', borderDownColor: '#ff3d3d',
        wickUpColor: '#00c851', wickDownColor: '#ff3d3d',
      });
      candleSeries.setData(
        priceData.bars.map(b => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close }))
      );

      // Signal markers — must be sorted by time for lightweight-charts v4
      const assetSignals = signals.filter(s => s.asset === chartAsset);
      const firstBarTime = priceData.bars[0].time;
      const lastBarTime = priceData.bars[priceData.bars.length - 1].time;

      const markerList = assetSignals
        .filter(s => s.created_at.slice(0, 10) >= firstBarTime && s.created_at.slice(0, 10) <= lastBarTime)
        .map(s => ({
          time: s.created_at.slice(0, 10) as Time,
          position: (s.direction === 'LONG' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
          color: s.direction === 'LONG' ? '#00c851' : '#ff3d3d',
          shape: (s.direction === 'LONG' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
          text: `${s.direction} @${formatPrice(s.entry_price, s.asset)}`,
        }))
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));

      if (markerList.length > 0) candleSeries.setMarkers(markerList);

      // Target / stop lines for signals
      for (const s of assetSignals) {
        const startBar = priceData.bars.find(b => b.time >= s.created_at.slice(0, 10));
        const endBar = priceData.bars[priceData.bars.length - 1];
        if (!startBar || !endBar || startBar.time >= endBar.time) continue;

        if (s.take_profit) {
          const targetLine = chart.addLineSeries({
            color: s.direction === 'LONG' ? '#00c85166' : '#ff3d3d66',
            lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false,
          });
          targetLine.setData([
            { time: startBar.time as Time, value: s.take_profit },
            { time: endBar.time as Time, value: s.take_profit },
          ]);
        }

        if (s.stop_loss) {
          const stopLine = chart.addLineSeries({
            color: '#ff3d3d44', lineWidth: 1, lineStyle: 3,
            lastValueVisible: false, priceLineVisible: false,
          });
          stopLine.setData([
            { time: startBar.time as Time, value: s.stop_loss },
            { time: endBar.time as Time, value: s.stop_loss },
          ]);
        }
      }
    } else {
      // Line chart
      const lineSeries = chart.addLineSeries({
        color: '#4da6ff',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      lineSeries.setData(
        priceData.bars.map(b => ({ time: b.time as Time, value: b.close }))
      );

      // Signal markers on line chart — must be sorted
      const assetSignals = signals.filter(s => s.asset === chartAsset);
      const firstBarTime = priceData.bars[0].time;
      const lastBarTime = priceData.bars[priceData.bars.length - 1].time;
      const lineMarkers = assetSignals
        .filter(s => s.created_at.slice(0, 10) >= firstBarTime && s.created_at.slice(0, 10) <= lastBarTime)
        .map(s => ({
          time: s.created_at.slice(0, 10) as Time,
          position: (s.direction === 'LONG' ? 'belowBar' : 'aboveBar') as SeriesMarkerPosition,
          color: s.direction === 'LONG' ? '#00c851' : '#ff3d3d',
          shape: (s.direction === 'LONG' ? 'arrowUp' : 'arrowDown') as SeriesMarkerShape,
          text: `${s.direction} @${formatPrice(s.entry_price, s.asset)}`,
        }))
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));

      if (lineMarkers.length > 0) lineSeries.setMarkers(lineMarkers);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [chartAsset, chartType, signals, stats]);

  const handleReset = () => {
    if (!confirm('Reset all signal results to PENDING? This will clear all close prices, P&L, and status from the signal library.')) return;
    onSignalsChange(signals.map(s => ({
      ...s,
      status: 'pending' as const,
      close_price: undefined,
      close_date: undefined,
      pnl_pct: undefined,
      r_multiple: undefined,
      actual_entry_price: undefined,
    })));
    setStats(null);
  };

  const runBacktestHandler = async () => {
    setRunning(true);
    setError('');
    try {
      const priceDataMap: Record<string, PriceBar[]> = {};
      const selectedAssets = config.assets.length > 0 ? config.assets : [];
      if (selectedAssets.length === 0) {
        setError('Select an asset before running the backtest.');
        setRunning(false);
        return;
      }

      // Helper: load stored price data by exact key or case-insensitive fallback
      const loadStored = (asset: string) => {
        const exact = loadPriceData(asset);
        if (exact) return exact;
        const altKey = storedTickers.find(t => t.toUpperCase() === asset.toUpperCase());
        return altKey ? loadPriceData(altKey) : null;
      };

      if (config.price_data_source === 'yfinance') {
        for (const asset of selectedAssets) {
          const stored = loadStored(asset);
          if (stored) {
            priceDataMap[asset] = stored.bars;
          } else {
            const yfTicker = normalizeTickerForYF(asset);
            try {
              const res = await fetch(
                `/api/prices/${yfTicker}?interval=1d&start=${config.start_date}&end=${config.end_date}`
              );
              if (res.ok) {
                const data = await res.json();
                priceDataMap[asset] = data.bars;
                // Persist to localStorage so the chart and subsequent runs can use it
                savePriceData({
                  ticker: asset,
                  bars: data.bars,
                  last_updated: new Date().toISOString(),
                  source: 'yfinance',
                });
              } else {
                const err = await res.json().catch(() => ({}));
                setError(e => e + (e ? '\n' : '') + `Fetch failed for ${asset}: ${err.detail ?? res.statusText}`);
              }
            } catch {
              setError(e => e + (e ? '\n' : '') + `Could not reach backend for ${asset}.`);
            }
          }
        }
      } else {
        for (const asset of selectedAssets) {
          const stored = loadStored(asset);
          if (stored) priceDataMap[asset] = stored.bars;
        }
      }

      const filteredSignals = signals.filter(s =>
        selectedAssets.includes(s.asset) &&
        s.created_at >= config.start_date &&
        s.created_at <= config.end_date
      );

      if (config.use_ai_normalization) {
        const rawTexts = filteredSignals.filter(s => s.raw_text).map(s => s.raw_text!);
        if (rawTexts.length > 0) {
          try {
            await fetch('/api/ai/parse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ signals: rawTexts }),
            });
          } catch {}
        }
      }

      const result = runBacktest(filteredSignals, priceDataMap, config);
      setStats(result);

      // Push results back into the signal library
      const tradeById: Record<string, typeof result.trades[0]> = {};
      for (const trade of result.trades) tradeById[trade.signal.id] = trade;

      const updatedSignals = signals.map(s => {
        const trade = tradeById[s.id];
        if (trade) {
          return {
            ...s,
            status: trade.signal.status,
            close_price: trade.signal.close_price,
            close_date: trade.signal.close_date,
            pnl_pct: trade.signal.pnl_pct,
            r_multiple: trade.signal.r_multiple,
            actual_entry_price: trade.actual_entry_price,
          };
        }
        if (result.unfilledIds.includes(s.id)) {
          return { ...s, status: 'unfilled' as const };
        }
        return s;
      });
      onSignalsChange(updatedSignals);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  const fmtStat = (n: number | null | undefined, dp = 2, suffix = '') =>
    (n == null || !isFinite(n)) ? 'N/A' : n.toFixed(dp) + suffix;

  return (
    <div className="backtest-layout">
      {/* Config panel */}
      <div className="panel backtest-config">
        <div className="panel-title">BACKTEST CONFIGURATION</div>
        <div className="form-row-inline">
          <div className="form-row">
            <label>ASSET</label>
            {selectableAssets.length > 0 ? (
              <select
                className="inp"
                value={selectedAsset}
                onChange={e => {
                  const v = e.target.value;
                  setConfig({ ...config, assets: v ? [v] : [] });
                  setChartAsset(v);
                }}
              >
                {selectableAssets.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <div className="inp" style={{ color: 'var(--text-muted)', lineHeight: '28px' }}>
                No assets — fetch price data in the DATABASE tab
              </div>
            )}
          </div>
          <div className="form-row">
            <label>DATE RANGE</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="inp" type="date" value={config.start_date} onChange={e => setConfig({ ...config, start_date: e.target.value })} />
              <span style={{ color: 'var(--text-muted)', lineHeight: '28px' }}>→</span>
              <input className="inp" type="date" value={config.end_date} onChange={e => setConfig({ ...config, end_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label>DATA SOURCE</label>
            <div className="segmented-control small">
              <button className={config.price_data_source === 'yfinance' ? 'active' : ''} onClick={() => setConfig({ ...config, price_data_source: 'yfinance' })}>YFINANCE</button>
              <button className={config.price_data_source === 'excel' ? 'active' : ''} onClick={() => setConfig({ ...config, price_data_source: 'excel' })}>EXCEL / CSV</button>
            </div>
          </div>
          <div className="form-row">
            <label className="toggle-label">
              <input type="checkbox" checked={config.use_ai_normalization} onChange={e => setConfig({ ...config, use_ai_normalization: e.target.checked })} />
              <span style={{ marginLeft: 6 }}>USE AI NORMALIZATION (GEMINI)</span>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-end' }}>
            <button className="btn-primary" onClick={runBacktestHandler} disabled={running || signals.length === 0}>
              {running ? 'RUNNING...' : 'RUN BACKTEST'}
            </button>
            <button className="btn-secondary" onClick={handleReset} disabled={running || signals.length === 0} title="Reset all signal results back to PENDING">
              RESET RESULTS
            </button>
          </div>
        </div>
        {error && <div className="error-msg">{error}</div>}
        {stats?.missing && stats.missing.length > 0 && (
          <div className="warning-msg">DATA MISSING for: {[...new Set(stats.missing)].join(', ')} — skipped.</div>
        )}
        {stats?.unfilled && stats.unfilled.length > 0 && (
          <div className="warning-msg">LIMIT UNFILLED: {stats.unfilled.join(', ')} — limit price never touched within max holding days.</div>
        )}
      </div>

      {/* Price chart — always visible when data is stored */}
      <div className="panel">
        <div className="panel-header-row">
          <div className="panel-title">PRICE CHART{chartAsset ? ` — ${chartAsset}` : ''}</div>
          <div className="segmented-control small" style={{ margin: 0 }}>
            <button className={chartType === 'candle' ? 'active' : ''} onClick={() => setChartType('candle')}>CANDLE</button>
            <button className={chartType === 'line' ? 'active' : ''} onClick={() => setChartType('line')}>LINE</button>
          </div>
        </div>
        {chartAsset && loadPriceData(chartAsset) ? (
          <div ref={chartContainerRef} style={{ width: '100%' }} />
        ) : (
          <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {selectableAssets.length === 0
              ? 'FETCH PRICE DATA IN THE DATABASE TAB TO VIEW CHART'
              : `NO DATA STORED FOR ${chartAsset}`}
          </div>
        )}
      </div>

      {/* Results — only after backtest */}
      {stats && (
        <div className="backtest-results">
          <div className="backtest-left">
            <div className="panel stats-panel">
              <div className="panel-title">STATISTICS</div>
              <StatRow label="TOTAL TRADES" value={String(stats.total_trades)} />
              <StatRow label="WIN RATE" value={fmtStat(stats.win_rate) + '%'} color={stats.win_rate >= 50 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <StatRow label="AVG P&L" value={fmtStat(stats.avg_pnl_pct) + '%'} color={stats.avg_pnl_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <StatRow label="AVG R-MULTIPLE" value={fmtStat(stats.avg_r_multiple)} />
              <StatRow label="EXPECTANCY" value={fmtStat(stats.expectancy) + '%'} color={stats.expectancy >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <StatRow label="PROFIT FACTOR" value={isFinite(stats.profit_factor) ? fmtStat(stats.profit_factor) : 'Inf'} color={stats.profit_factor >= 1 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <StatRow label="MAX DRAWDOWN" value={fmtStat(stats.max_drawdown_pct) + '%'} color="var(--accent-red)" />
              <StatRow label="SHARPE RATIO" value={fmtStat(stats.sharpe_ratio)} />
              <StatRow label="TOTAL RETURN" value={fmtStat(stats.total_return_pct) + '%'} color={stats.total_return_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'} />
              <button className="btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={() => exportBacktestToExcel(stats)}>
                EXPORT TO EXCEL
              </button>
            </div>

            <div className="panel trade-log-panel">
              <div className="panel-title">TRADE LOG ({stats.trades.length})</div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>ASSET</th><th>DIR</th><th>ENTRY DATE</th><th>FILL PRICE</th><th>CLOSE DATE</th><th>P&L%</th><th>R</th><th>DAYS</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {stats.trades.map((t, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td className="mono bold">{t.signal.asset}</td>
                        <td className={`mono ${t.signal.direction === 'LONG' ? 'green' : 'red'}`}>{t.signal.direction}</td>
                        <td className="mono dim">{t.entry_date}</td>
                        <td className="mono dim">{formatPrice(t.actual_entry_price, t.signal.asset)}</td>
                        <td className="mono dim">{t.close_date ?? '—'}</td>
                        <td className={`mono ${t.pnl_pct >= 0 ? 'green' : 'red'}`}>{formatPct(t.pnl_pct)}</td>
                        <td className="mono dim">{formatR(t.r_multiple)}</td>
                        <td className="mono dim">{t.days_held}</td>
                        <td className={`mono ${t.status === 'closed_win' ? 'green' : t.status === 'closed_loss' ? 'red' : 'dim'}`} style={{ fontSize: 11 }}>
                          {t.status.toUpperCase().replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="backtest-right">
            <div className="panel">
              <div className="panel-title">EQUITY CURVE</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={[{ date: 'Start', equity: 100 }, ...stats.equity_curve]}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00c851" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00c851" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#555', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                  <Area type="monotone" dataKey="equity" stroke="#00c851" fill="url(#ecGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {!stats && !running && signals.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          ADD SIGNALS IN THE SIGNALS TAB, THEN RUN BACKTEST TO SEE RESULTS
        </div>
      )}
    </div>
  );
}
