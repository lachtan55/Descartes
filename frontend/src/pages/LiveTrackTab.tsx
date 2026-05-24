import { useState, useEffect, useCallback } from 'react';
import { TradingSignal } from '../types';
import { updateSignal, loadPriceData } from '../utils/storage';
import { isSignalExpired } from '../utils/expiry';
import { normalizeTickerForYF, formatPrice, formatPct } from '../utils/tickers';

interface Props {
  signals: TradingSignal[];
  onSignalsChange: (s: TradingSignal[]) => void;
}

interface LivePrice {
  price: number;
  loading: boolean;
  error: string;
}

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80, h = 24;
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={pts} fill="none" stroke={isUp ? '#00c851' : '#ff3d3d'} strokeWidth={1} />
    </svg>
  );
}

export default function LiveTrackTab({ signals, onSignalsChange }: Props) {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(refreshInterval);
  const [closeModal, setCloseModal] = useState<{ id: string; price: string; date: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  // Filter: pending or active, AND not expired per the unified expiry check
  const activeSignals = signals.filter(s => {
    if (s.status !== 'pending' && s.status !== 'active') return false;
    const bars = loadPriceData(s.asset)?.bars;
    return !isSignalExpired(s, bars);
  });

  const fetchPrices = useCallback(async () => {
    if (activeSignals.length === 0) return;
    const assets = [...new Set(activeSignals.map(s => s.asset))];
    const updates: Record<string, LivePrice> = {};

    await Promise.all(assets.map(async asset => {
      updates[asset] = { price: 0, loading: true, error: '' };
      setPrices(prev => ({ ...prev, [asset]: { price: prev[asset]?.price ?? 0, loading: true, error: '' } }));
      try {
        const yfTicker = normalizeTickerForYF(asset);
        const res = await fetch(`/api/prices/${yfTicker}/latest`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        updates[asset] = { price: data.price, loading: false, error: '' };
        setSparklines(prev => ({
          ...prev,
          [asset]: [...(prev[asset] ?? []).slice(-19), data.price],
        }));
      } catch {
        updates[asset] = { price: prices[asset]?.price ?? 0, loading: false, error: 'unavailable' };
      }
    }));

    setPrices(prev => ({ ...prev, ...updates }));
    setLastRefresh(new Date().toISOString().replace('T', ' ').slice(0, 19));
    setCountdown(refreshInterval);
  }, [activeSignals.length, refreshInterval]);

  useEffect(() => {
    fetchPrices();
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchPrices();
          return refreshInterval;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, refreshInterval, fetchPrices]);

  const handleCloseManually = () => {
    if (!closeModal) return;
    const price = parseFloat(closeModal.price);
    if (isNaN(price)) return;
    const signal = signals.find(s => s.id === closeModal.id);
    if (!signal) return;
    const pnl = signal.direction === 'LONG'
      ? (price - signal.entry_price) / signal.entry_price * 100
      : (signal.entry_price - price) / signal.entry_price * 100;
    const status = pnl >= 0 ? 'closed_win' : 'closed_loss';
    onSignalsChange(updateSignal(closeModal.id, { close_price: price, close_date: closeModal.date, pnl_pct: pnl, status }));
    setCloseModal(null);
  };

  const calcDistancePct = (signal: TradingSignal, currentPrice: number): number => {
    if (!currentPrice) return NaN;
    return signal.direction === 'LONG'
      ? (signal.take_profit - currentPrice) / currentPrice * 100
      : (currentPrice - signal.take_profit) / currentPrice * 100;
  };

  // Days held: calendar days since created_at
  const calcDaysHeld = (signal: TradingSignal): number => {
    return Math.round((Date.now() - new Date(signal.created_at).getTime()) / 86400000);
  };

  return (
    <div className="live-track-tab">
      <div className="panel">
        <div className="panel-header-row">
          <div className="panel-title">LIVE TRACK — {activeSignals.length} ACTIVE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastRefresh && <span className="dim mono" style={{ fontSize: 11 }}>LAST: {lastRefresh}</span>}
            <span className="dim mono" style={{ fontSize: 11 }}>NEXT: {paused ? 'PAUSED' : countdown + 's'}</span>
            <div className="form-row" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>INTERVAL (s)</label>
              <input className="inp" type="number" min={10} max={3600} value={refreshInterval} style={{ width: 60 }}
                onChange={e => setRefreshInterval(parseInt(e.target.value) || 60)} />
            </div>
            <button className="btn-secondary" onClick={() => setPaused(p => !p)}>
              {paused ? 'RESUME' : 'PAUSE'}
            </button>
            <button className="btn-secondary" onClick={() => { fetchPrices(); setCountdown(refreshInterval); }}>
              REFRESH NOW
            </button>
          </div>
        </div>

        <div className="table-wrapper" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ASSET</th>
                <th>DIR</th>
                <th>ENTRY</th>
                <th>CURRENT</th>
                <th>TARGET</th>
                <th>TO TARGET%</th>
                <th>MOM</th>
                <th>DAYS</th>
                <th>HOLD UNTIL</th>
                <th>STATUS</th>
                <th>SPARKLINE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {activeSignals.map((s, i) => {
                const lp = prices[s.asset];
                const current = lp?.price ?? 0;
                const distPct = calcDistancePct(s, current);
                const daysHeld = calcDaysHeld(s);
                const nearTarget = !isNaN(distPct) && distPct >= 0 && distPct < 2;
                const nearStop = s.stop_loss !== undefined && current !== 0 && (
                  s.direction === 'LONG'
                    ? (current - s.stop_loss) / s.stop_loss * 100 < 2
                    : (s.stop_loss - current) / s.stop_loss * 100 < 2
                );

                return (
                  <tr key={s.id}
                    className={`${i % 2 === 0 ? 'row-even' : 'row-odd'} ${nearTarget ? 'row-near-target' : ''} ${nearStop ? 'row-near-stop' : ''}`}
                  >
                    <td className="mono bold">{s.asset}</td>
                    <td className={`mono ${s.direction === 'LONG' ? 'green' : 'red'}`}>{s.direction}</td>
                    <td className="mono">{formatPrice(s.entry_price, s.asset)}</td>
                    <td className="mono">
                      {lp?.loading ? '...' : lp?.error ? <span className="red">ERR</span> : formatPrice(current, s.asset)}
                    </td>
                    <td className="mono">{formatPrice(s.take_profit, s.asset)}</td>
                    <td className={`mono ${isNaN(distPct) ? 'dim' : distPct >= 0 ? 'green' : 'red'}`}>
                      {isNaN(distPct) ? '—' : formatPct(distPct)}
                    </td>
                    <td className="mono dim" style={{ fontSize: 11 }}>
                      {s.momentum_strength[0]}{s.momentum_direction[0]}
                    </td>
                    <td className="mono dim">{daysHeld}d</td>
                    <td className="mono dim" style={{ fontSize: 11 }}>
                      {s.holdUntil ?? '—'}
                    </td>
                    <td className="mono dim" style={{ fontSize: 11, color: s.status === 'active' ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {s.status.toUpperCase()}
                    </td>
                    <td>
                      <Sparkline prices={sparklines[s.asset] ?? []} />
                    </td>
                    <td>
                      <button className="btn-xs amber" onClick={() => setCloseModal({ id: s.id, price: String(current || ''), date: new Date().toISOString().slice(0, 10) })}>
                        CLOSE
                      </button>
                    </td>
                  </tr>
                );
              })}
              {activeSignals.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                  NO ACTIVE SIGNALS — add signals in the SIGNALS tab
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {closeModal && (
        <div className="modal-overlay" onClick={() => setCloseModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">CLOSE SIGNAL MANUALLY</div>
            <div className="form-row"><label>CLOSE PRICE</label><input className="inp" type="number" step="0.01" value={closeModal.price} onChange={e => setCloseModal({ ...closeModal, price: e.target.value })} /></div>
            <div className="form-row"><label>CLOSE DATE</label><input className="inp" type="date" value={closeModal.date} onChange={e => setCloseModal({ ...closeModal, date: e.target.value })} /></div>
            <div className="btn-row">
              <button className="btn-primary" onClick={handleCloseManually}>CONFIRM CLOSE</button>
              <button className="btn-secondary" onClick={() => setCloseModal(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
