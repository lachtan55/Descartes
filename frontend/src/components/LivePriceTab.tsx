/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react';
import IBGatewayPanel from './IBGatewayPanel';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, LogicalRange } from 'lightweight-charts';

// ─── Types ───────────────────────────────────────────────────────────────────

type Timeframe = '1H' | '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX';

const CANDLE_SIZES: { label: string; value: Timeframe }[] = [
  { label: '1 MIN',  value: '1H'  },
  { label: '5 MIN',  value: '1D'  },
  { label: '30 MIN', value: '1W'  },
  { label: '1 HR',   value: '1M'  },
  { label: '4 HR',   value: '6M'  },
  { label: '1 DAY',  value: '1Y'  },
  { label: '1 WK',   value: 'MAX' },
];

interface ContractResult {
  symbol: string;
  local_symbol: string;
  display_name: string;
  sec_type: string;
  exchange: string;
  currency: string;
  last_trade_date: string | null;
}

interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function wsUrl(symbol: string, secType: string, exchange: string, currency: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/bars/${symbol}?sec_type=${secType}&exchange=${exchange}&currency=${currency}`;
}

// ─── Search bar ───────────────────────────────────────────────────────────────

interface SearchBarProps {
  onSelect: (c: ContractResult) => void;
}

function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContractResult[]>([]);
  const [open, setOpen] = useState(false);
  const [ibError, setIbError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); setIbError(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/search?q=${encodeURIComponent(q.trim())}`);
      if (res.status === 503) {
        setIbError('IB Gateway not connected');
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      setIbError(null);
      const data: ContractResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setIbError('Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const handleSelect = (c: ContractResult) => {
    setQuery(c.display_name);
    setOpen(false);
    setResults([]);
    setIbError(null);
    onSelect(c);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <input
          className="inp"
          style={{ width: 240, textTransform: 'uppercase', letterSpacing: '1px' }}
          placeholder="SYMBOL  e.g. GC, CL, AAPL"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          spellCheck={false}
          autoComplete="off"
        />
        {loading && (
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            SEARCHING...
          </span>
        )}
      </div>

      {ibError && (
        <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-red)', letterSpacing: '0.5px' }}>
          ● {ibError}
        </div>
      )}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 50,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-accent)',
          minWidth: 420,
          marginTop: 2,
        }}>
          {results.map((c, i) => (
            <div
              key={i}
              onClick={() => handleSelect(c)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                cursor: 'pointer',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', letterSpacing: '1px' }}>
                {c.display_name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                {c.sec_type}
                {c.exchange ? ` · ${c.exchange}` : ''}
                {` · ${c.currency}`}
                {c.last_trade_date ? ` · ${c.last_trade_date}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Price header ─────────────────────────────────────────────────────────────

interface PriceHeaderProps {
  contract: ContractResult;
  lastBar: OhlcBar | null;
  wsStatus: 'connecting' | 'live' | 'disconnected';
}

function PriceHeader({ contract, lastBar, wsStatus }: PriceHeaderProps) {
  const wsColor = wsStatus === 'live' ? 'var(--accent-green)' : wsStatus === 'connecting' ? 'var(--text-muted)' : 'var(--accent-red)';
  const wsLabel = wsStatus === 'live' ? '● LIVE' : wsStatus === 'connecting' ? '● CONNECTING...' : '● DISCONNECTED';

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent-amber)', letterSpacing: '2px' }}>
        {contract.display_name}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>
        {contract.sec_type} · {contract.exchange} · {contract.currency}
      </span>
      {lastBar && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 8 }}>
          {lastBar.close.toFixed(2)}
        </span>
      )}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: wsColor, marginLeft: 'auto', letterSpacing: '0.5px' }}>
        {wsLabel}
      </span>
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────

interface ChartPanelProps {
  bars: OhlcBar[];
  liveBar: OhlcBar | null;
  contract: ContractResult;
  candleSize: Timeframe;
}

function ChartPanel({ bars, liveBar, contract, candleSize }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const hasMoreDataRef = useRef(true);
  const oldestTimestampRef = useRef<number | null>(null);
  const currentBarsRef = useRef<OhlcBar[]>([]);

  const loadMoreBars = useCallback(async () => {
    if (!oldestTimestampRef.current || isLoadingMoreRef.current || !hasMoreDataRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const endDate = new Date(oldestTimestampRef.current * 1000)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, '');
      const params = new URLSearchParams({
        timeframe: candleSize,
        end_date: endDate,
        sec_type: contract.sec_type,
        exchange: contract.exchange,
        currency: contract.currency,
      });
      const res = await fetch(`/api/ib/bars/${contract.symbol}?${params}`);
      if (!res.ok) return;
      const newBars: OhlcBar[] = await res.json();
      if (!newBars || newBars.length === 0) {
        hasMoreDataRef.current = false;
        return;
      }
      const filtered = newBars.filter(b => (b.time as number) < oldestTimestampRef.current!);
      if (filtered.length === 0) {
        hasMoreDataRef.current = false;
        return;
      }
      oldestTimestampRef.current = filtered[0].time as number;
      const merged = [...filtered, ...currentBarsRef.current];
      currentBarsRef.current = merged;
      seriesRef.current?.setData(merged.map(b => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })));
    } catch (e) {
      console.error('Failed to load more bars:', e);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [contract, candleSize]);

  // Keep a fresh ref to loadMoreBars so the range handler (registered once) always calls the latest version
  const loadMoreBarsRef = useRef(loadMoreBars);
  useEffect(() => { loadMoreBarsRef.current = loadMoreBars; }, [loadMoreBars]);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'var(--bg-primary)' } as { color: string }, // lightweight-charts background type expects a specific union; cast to loosen it safely
        textColor: '#555555',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    const series = chart.addCandlestickSeries({
      upColor: '#00c851',
      downColor: '#ff3d3d',
      borderUpColor: '#00c851',
      borderDownColor: '#ff3d3d',
      wickUpColor: '#00c851',
      wickDownColor: '#ff3d3d',
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    ro.observe(containerRef.current);

    const rangeHandler = (range: LogicalRange | null) => {
      if (!range || isLoadingMoreRef.current || !hasMoreDataRef.current) return;
      if (range.from < 10) loadMoreBarsRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeHandler);

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeHandler);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial bars — resets pagination state whenever bars array is replaced (new contract or candleSize)
  useEffect(() => {
    if (!seriesRef.current || bars.length === 0) return;
    hasMoreDataRef.current = true;
    oldestTimestampRef.current = bars[0].time as number;
    currentBarsRef.current = bars;
    const data: CandlestickData[] = bars.map(b => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // Stream live bars
  useEffect(() => {
    if (!seriesRef.current || !liveBar) return;
    seriesRef.current.update({
      time: liveBar.time as Time,
      open: liveBar.open,
      high: liveBar.high,
      low: liveBar.low,
      close: liveBar.close,
    });
  }, [liveBar]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isLoadingMore && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
          zIndex: 10,
          letterSpacing: '1px',
        }}>
          LOADING...
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function LivePriceTab() {
  const [selected, setSelected] = useState<ContractResult | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [bars, setBars] = useState<OhlcBar[]>([]);
  const [liveBar, setLiveBar] = useState<OhlcBar | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'live' | 'disconnected'>('disconnected');
  const [barsError, setBarsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Keep a stable ref to selected so the timeframe effect can read it
  // without causing double-fetches when the contract itself changes
  const selectedRef = useRef<ContractResult | null>(null);
  selectedRef.current = selected;

  const fetchBars = useCallback(async (c: ContractResult, tf: Timeframe) => {
    setBars([]);
    setBarsError(null);
    const params = new URLSearchParams({
      timeframe: tf,
      sec_type: c.sec_type,
      exchange: c.exchange,
      currency: c.currency,
    });
    try {
      const res = await fetch(`/api/ib/bars/${c.symbol}?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setBarsError(err.detail ?? 'Failed to load bars');
      } else {
        setBars(await res.json());
      }
    } catch {
      setBarsError('Network error loading bars');
    }
  }, []);

  const handleSelect = useCallback(async (c: ContractResult) => {
    wsRef.current?.close();
    setSelected(c);
    setLiveBar(null);
    setWsStatus('disconnected');

    await fetchBars(c, timeframe);

    // Open WebSocket stream for live bars
    setWsStatus('connecting');
    const url = wsUrl(c.symbol, c.sec_type, c.exchange, c.currency);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => { /* connected — waiting for first bar before showing LIVE */ };
    let wsLive = false;
    ws.onmessage = (e) => {
      if (!wsLive) { wsLive = true; setWsStatus('live'); }
      try { setLiveBar(JSON.parse(e.data)); } catch { /* ignore malformed frames */ }
    };
    ws.onclose = () => setWsStatus('disconnected');
    ws.onerror = () => setWsStatus('disconnected');
  }, [timeframe, fetchBars]);

  // Refetch bars when timeframe changes (contract stays the same)
  useEffect(() => {
    if (selectedRef.current) fetchBars(selectedRef.current, timeframe);
  }, [timeframe, fetchBars]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup WS on unmount
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* IB Gateway connection panel */}
      <IBGatewayPanel />

      {/* Search row */}
      <div className="panel" style={{ marginBottom: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span className="panel-title" style={{ margin: 0 }}>LIVE PRICE DATA</span>
          <SearchBar onSelect={handleSelect} />
        </div>
      </div>

      {/* Chart area */}
      {selected ? (
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginBottom: 0 }}>
          <PriceHeader contract={selected} lastBar={liveBar} wsStatus={wsStatus} />

          {/* Timeframe switcher */}
          <div className="segmented-control small" style={{ marginBottom: 8, width: 'fit-content' }}>
            {CANDLE_SIZES.map(({ label, value }) => (
              <button
                key={value}
                className={timeframe === value ? 'active' : ''}
                onClick={() => setTimeframe(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {barsError ? (
            <div className="error-msg">{barsError}</div>
          ) : bars.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '2px' }}>
              — WAITING FOR DATA —
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChartPanel bars={bars} liveBar={liveBar} contract={selected} candleSize={timeframe} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '2px' }}>
          — SELECT A CONTRACT TO VIEW LIVE PRICE DATA —
        </div>
      )}
      {/* ─── ADD NEW CHART TYPES OR DATA PANELS HERE ─── */}
    </div>
  );
}
