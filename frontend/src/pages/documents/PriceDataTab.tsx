import { useState, useEffect, useRef, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, Time } from 'lightweight-charts';
import { StoredPriceData } from '../../types';
import { loadPriceData, savePriceData, deletePriceData, listStoredPriceDatasets } from '../../utils/storage';
import { normalizeTickerForYF } from '../../utils/tickers';

interface FetchResult {
  ticker: string;
  interval: string;
  newBars: number;    // bars returned by this fetch
  totalBars: number;  // bars in storage after merge
  start: string;
  end: string;
  merged: boolean;    // was there pre-existing data to merge with?
}

function formatBytes(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function PriceDataTab() {
  const [yfTicker, setYfTicker]     = useState('');
  const [yfStart,  setYfStart]      = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [yfEnd,      setYfEnd]      = useState(new Date().toISOString().slice(0, 10));
  const [yfInterval, setYfInterval] = useState('1d');
  const [yfLoading,  setYfLoading]  = useState(false);
  const [yfError,    setYfError]    = useState('');
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);

  const [datasets, setDatasets]         = useState<StoredPriceData[]>([]);
  const [previewTicker, setPreviewTicker] = useState<string | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);

  const refreshDatasets = useCallback(() => {
    setDatasets(listStoredPriceDatasets());
  }, []);

  useEffect(() => { refreshDatasets(); }, [refreshDatasets]);

  // Chart preview
  useEffect(() => {
    if (!chartContainerRef.current || !previewTicker) return;
    const priceData = loadPriceData(previewTicker);
    if (!priceData || priceData.bars.length === 0) return;

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth || 800,
      height: 260,
      layout: { background: { color: '#141414' }, textColor: '#888' },
      grid: { vertLines: { color: '#1e1e1e' }, horzLines: { color: '#1e1e1e' } },
      crosshair: { vertLine: { color: '#f0a500' }, horzLine: { color: '#f0a500' } },
      timeScale: { borderColor: '#2a2a2a' },
      rightPriceScale: { borderColor: '#2a2a2a' },
    });
    chartRef.current = chart;

    const lineSeries = chart.addLineSeries({
      color: '#4da6ff', lineWidth: 2, lastValueVisible: true, priceLineVisible: false,
    });
    lineSeries.setData(priceData.bars.map(b => ({ time: b.time as Time, value: b.close })));
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [previewTicker]);

  const fetchYfinance = async () => {
    if (!yfTicker.trim()) return;
    setYfLoading(true);
    setYfError('');
    setFetchResult(null);

    const ticker     = yfTicker.trim().toUpperCase();
    const normalized = normalizeTickerForYF(ticker);

    try {
      // 1 — store in backend SQLite (INSERT OR REPLACE → automatic range merge)
      const postRes = await fetch('/api/data/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: normalized, start: yfStart, end: yfEnd, interval: yfInterval }),
      });
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        setYfError(err.detail ?? `Fetch failed (${postRes.status})`);
        return;
      }
      const summary = await postRes.json();   // { ticker, rows, start, end, interval }
      const newBars: number = summary.rows;

      // 2 — pull the FULL merged dataset from SQLite and push into localStorage
      const getRes = await fetch(`/api/data/prices/${encodeURIComponent(normalized)}?interval=${yfInterval}`);
      if (getRes.ok) {
        const full = await getRes.json();     // { ticker, interval, bars: [...] }
        const existingBefore = loadPriceData(ticker);
        const hadData = (existingBefore?.bars.length ?? 0) > 0;
        const totalBars = savePriceData({
          ticker,
          bars:         full.bars,
          last_updated: new Date().toISOString(),
          source:       'yfinance',
        });
        const merged = loadPriceData(ticker);
        setFetchResult({
          ticker,
          interval: yfInterval,
          newBars,
          totalBars,
          start: merged?.bars[0]?.time ?? summary.start,
          end:   merged?.bars[merged.bars.length - 1]?.time ?? summary.end,
          merged: hadData,
        });
        refreshDatasets();
      } else {
        // Fallback — store only the fetched range (no full pull available)
        setFetchResult({
          ticker,
          interval: yfInterval,
          newBars,
          totalBars: newBars,
          start: summary.start ?? yfStart,
          end:   summary.end   ?? yfEnd,
          merged: false,
        });
      }
    } catch {
      setYfError('Backend unreachable. Ensure the FastAPI server is running.');
    } finally {
      setYfLoading(false);
    }
  };

  const handleDelete = async (ticker: string, interval: string) => {
    if (!confirm(`Delete price data for ${ticker} (${interval.toUpperCase()})? This cannot be undone.`)) return;

    // Remove from localStorage
    deletePriceData(ticker);

    // Remove from backend SQLite
    try {
      await fetch(`/api/data/prices/${encodeURIComponent(normalizeTickerForYF(ticker))}?interval=${interval}`, {
        method: 'DELETE',
      });
    } catch {
      // Non-fatal — localStorage is already cleared
    }

    if (previewTicker === ticker) setPreviewTicker(null);
    if (fetchResult?.ticker === ticker) setFetchResult(null);
    refreshDatasets();
  };

  return (
    <div className="data-tab">
      {/* ── Fetch panel ─────────────────────────────────────────── */}
      <div className="panel data-section">
        <div className="panel-title">YFINANCE DATA FETCH</div>
        <div className="form-row-inline">
          <div className="form-row">
            <label>TICKER</label>
            <input
              className="inp"
              value={yfTicker}
              onChange={e => setYfTicker(e.target.value)}
              placeholder="GC, AAPL, BTC-USD"
              onKeyDown={e => e.key === 'Enter' && fetchYfinance()}
            />
          </div>
          <div className="form-row">
            <label>INTERVAL</label>
            <select className="inp" value={yfInterval} onChange={e => setYfInterval(e.target.value)}>
              <option value="1d">1D</option>
              <option value="1wk">1W</option>
              <option value="1mo">1M</option>
            </select>
          </div>
          <div className="form-row">
            <label>START</label>
            <input className="inp" type="date" value={yfStart} onChange={e => setYfStart(e.target.value)} />
          </div>
          <div className="form-row">
            <label>END</label>
            <input className="inp" type="date" value={yfEnd} onChange={e => setYfEnd(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={fetchYfinance}
            disabled={yfLoading || !yfTicker.trim()}
          >
            {yfLoading ? 'FETCHING...' : 'FETCH & STORE'}
          </button>
        </div>

        {yfError && <div className="error-msg">{yfError}</div>}

        {fetchResult && (
          <div style={{
            marginTop: 12, padding: '8px 12px',
            background: 'var(--bg-panel)',
            border: `1px solid ${fetchResult.merged ? 'var(--accent-amber)' : 'var(--accent-green)'}`,
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: fetchResult.merged ? 'var(--accent-amber)' : 'var(--accent-green)',
            display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            <span>{fetchResult.merged ? '⊕ MERGED' : '✓ STORED'}</span>
            <span>TICKER: {fetchResult.ticker}</span>
            <span>INTERVAL: {fetchResult.interval.toUpperCase()}</span>
            {fetchResult.merged && <span>NEW BARS: +{fetchResult.newBars}</span>}
            <span>TOTAL BARS: {fetchResult.totalBars}</span>
            <span>RANGE: {fetchResult.start} → {fetchResult.end}</span>
          </div>
        )}
      </div>

      {/* ── Stored datasets table ────────────────────────────────── */}
      <div className="panel data-section">
        <div className="panel-title">STORED DATASETS</div>

        {datasets.length === 0 ? (
          <div className="empty-msg" style={{ padding: 16 }}>
            No datasets yet. Use the fetch panel above to pull data from yFinance.
          </div>
        ) : (
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>TICKER</th>
                <th>BARS</th>
                <th>DATE RANGE</th>
                <th>SOURCE</th>
                <th>UPDATED</th>
                <th style={{ width: 110 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d, i) => (
                <tr
                  key={d.ticker}
                  className={`${i % 2 === 0 ? 'row-even' : 'row-odd'}${previewTicker === d.ticker ? ' row-near-target' : ''}`}
                >
                  <td className="mono bold">{d.ticker}</td>
                  <td className="mono">{formatBytes(d.bars.length)}</td>
                  <td className="mono dim">
                    {d.bars[0]?.time ?? '—'} → {d.bars[d.bars.length - 1]?.time ?? '—'}
                  </td>
                  <td className="mono dim">{d.source.toUpperCase()}</td>
                  <td className="mono dim">{d.last_updated.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-xs"
                        onClick={() => setPreviewTicker(previewTicker === d.ticker ? null : d.ticker)}
                      >
                        {previewTicker === d.ticker ? 'HIDE' : 'CHART'}
                      </button>
                      <button
                        className="btn-xs red"
                        title={`Delete ${d.ticker} price data`}
                        onClick={() => handleDelete(d.ticker, d.source === 'yfinance' ? yfInterval : '1d')}
                      >
                        DEL
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Chart preview inline */}
        {previewTicker && (
          <div style={{ marginTop: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{
              padding: '6px 10px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-amber)' }}>
                {previewTicker} — LINE CHART (CLOSE)
              </span>
              <button className="btn-xs" onClick={() => setPreviewTicker(null)}>✕ CLOSE</button>
            </div>
            <div ref={chartContainerRef} style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
