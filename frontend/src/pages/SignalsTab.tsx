import { useState } from 'react';
import { TradingSignal, AssetType, ParseResult } from '../types';
import { parseSignal, buildFullSignal } from '../utils/signalParser';
import { addSignal, deleteSignal, updateSignal, loadPriceData } from '../utils/storage';
import { isSignalExpired } from '../utils/expiry';
import { v4 as uuidv4 } from 'uuid';
import { formatPrice, formatPct } from '../utils/tickers';

interface Props {
  signals: TradingSignal[];
  onSignalsChange: (s: TradingSignal[]) => void;
}

type InputMode = 'parse' | 'manual';
type SortField = 'created_at' | 'asset' | 'direction' | 'entry_price' | 'status' | 'pnl_pct';

const today = new Date().toISOString().slice(0, 10);

const EMPTY_MANUAL: Partial<TradingSignal> = {
  asset: '', asset_type: 'equity', direction: 'LONG',
  entry_type: 'limit', entry_price: 0, take_profit: 0,
  momentum_strength: 'STRONG', momentum_direction: 'UP',
  stop_loss: undefined, holdUntil: undefined, notes: '', created_at: today,
};

// Resolve the effective status for display, incorporating live expiry logic.
function resolveDisplayStatus(signal: TradingSignal): TradingSignal['status'] {
  // Closed / unfilled signals: always show stored status
  if (['closed_win', 'closed_loss', 'unfilled'].includes(signal.status)) return signal.status;
  // Pending / active: check if expired per holdUntil or last stored price data
  const bars = loadPriceData(signal.asset)?.bars;
  if (isSignalExpired(signal, bars)) return 'expired';
  return signal.status;
}

function StatusBadge({ signal }: { signal: TradingSignal }) {
  const status = resolveDisplayStatus(signal);
  const colors: Record<string, string> = {
    pending:      'var(--accent-amber)',
    active:       'var(--accent-green)',
    closed_win:   'var(--accent-green)',
    closed_loss:  'var(--accent-red)',
    expired:      'var(--text-muted)',
    unfilled:     'var(--text-muted)',
  };
  const labels: Record<string, string> = {
    pending: 'PENDING', active: 'ACTIVE',
    closed_win: 'WIN', closed_loss: 'LOSS', expired: 'EXPIRED', unfilled: 'UNFILLED',
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 4, height: 4, background: colors[status] ?? 'var(--text-muted)', display: 'inline-block' }} />
      <span style={{ color: colors[status] ?? 'var(--text-muted)', fontSize: 11 }}>{labels[status] ?? status.toUpperCase()}</span>
    </span>
  );
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.7 ? 'var(--accent-green)' : value >= 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)';
  return <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{(value * 100).toFixed(0)}%</span>;
}

export default function SignalsTab({ signals, onSignalsChange }: Props) {
  const [mode, setMode] = useState<InputMode>('parse');
  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [manualForm, setManualForm] = useState<Partial<TradingSignal>>(EMPTY_MANUAL);
  const [filterAsset, setFilterAsset] = useState('');
  const [filterDir, setFilterDir] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TradingSignal>>({});

  const handleParse = () => {
    if (!rawText.trim()) return;
    setParseResult(parseSignal(rawText));
  };

  const handleConfirmSave = () => {
    if (!parseResult) return;
    if (parseResult.confidence < 0.6) {
      if (!confirm(`Parse confidence is ${(parseResult.confidence * 100).toFixed(0)}%. Save anyway?`)) return;
    }
    const signal = buildFullSignal({ ...parseResult.signal, id: uuidv4() });
    onSignalsChange(addSignal(signal));
    setRawText('');
    setParseResult(null);
  };

  const handleManualSave = () => {
    if (!manualForm.asset?.trim()) return;
    const signal = buildFullSignal({
      ...manualForm,
      momentum_direction: manualForm.direction === 'LONG' ? 'UP' : 'DOWN',
      id: uuidv4(),
      parsed_by: 'manual',
      status: 'pending',
    });
    onSignalsChange(addSignal(signal));
    setManualForm({ ...EMPTY_MANUAL, created_at: today });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this signal?')) onSignalsChange(deleteSignal(id));
  };

  const handleEditSave = () => {
    if (!editId) return;
    onSignalsChange(updateSignal(editId, editForm));
    setEditId(null);
  };

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else { setSortField(f); setSortAsc(true); }
  };

  const filtered = signals.filter(s => {
    if (filterAsset && !s.asset.toLowerCase().includes(filterAsset.toLowerCase())) return false;
    if (filterDir && s.direction !== filterDir) return false;
    if (filterStatus) {
      const disp = resolveDisplayStatus(s);
      if (disp !== filterStatus) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    const af = a[sortField] ?? '';
    const bf = b[sortField] ?? '';
    if (typeof af === 'number' && typeof bf === 'number') cmp = af - bf;
    else cmp = String(af).localeCompare(String(bf));
    return sortAsc ? cmp : -cmp;
  });

  const SortHdr = ({ field, label }: { field: SortField; label: string }) => (
    <th className="sortable" onClick={() => handleSort(field)}>
      {label}{sortField === field ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const isMarket = manualForm.entry_type === 'market';

  // Fields hidden from parse result preview
  const HIDDEN_PREVIEW_KEYS = ['id', 'raw_text', 'parsed_by', 'status'];

  return (
    <div className="signals-layout">
      {/* Left panel */}
      <div className="panel signals-input-panel">
        <div className="segmented-control">
          <button className={mode === 'parse' ? 'active' : ''} onClick={() => setMode('parse')}>PARSE TEXT</button>
          <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>MANUAL ENTRY</button>
        </div>

        {mode === 'parse' && (
          <div className="parse-mode">
            <textarea
              className="signal-textarea"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={'LONG GC | entry: 2345.50 | tp: 2410.00 | sl: 2300.00 | momentum: strong up\nSHORT COPX | entry: 38.20 | tp: 35.00 | hold until 2025-09-01'}
              rows={6}
            />
            <div className="btn-row">
              <button className="btn-primary" onClick={handleParse}>PARSE</button>
              <button className="btn-secondary" onClick={() => { setRawText(''); setParseResult(null); }}>CLEAR</button>
            </div>

            {parseResult && (
              <div className="parse-preview">
                <div className="preview-header">
                  PARSE RESULT — confidence: <ConfidenceDot value={parseResult.confidence} />
                  {parseResult.flags.length > 0 && (
                    <span style={{ color: 'var(--accent-amber)', marginLeft: 8, fontSize: 11 }}>
                      ⚠ {parseResult.flags.join(', ')}
                    </span>
                  )}
                </div>
                <table className="preview-table">
                  <tbody>
                    {Object.entries(parseResult.signal)
                      .filter(([k]) => !HIDDEN_PREVIEW_KEYS.includes(k))
                      .map(([k, v]) => (
                        <tr key={k}>
                          <td className="preview-key">{k.toUpperCase()}</td>
                          <td className="preview-val">{String(v ?? '—')}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <button
                  className="btn-primary"
                  style={{ marginTop: 8, width: '100%' }}
                  onClick={handleConfirmSave}
                >
                  CONFIRM & SAVE
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div className="manual-mode">
            <div className="form-row">
              <label>ENTRY DATE</label>
              <input
                className="inp"
                type="date"
                value={manualForm.created_at ?? today}
                onChange={e => setManualForm({ ...manualForm, created_at: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>ASSET</label>
              <input className="inp" value={manualForm.asset ?? ''} onChange={e => setManualForm({ ...manualForm, asset: e.target.value.toUpperCase() })} placeholder="GC, AAPL, BTC-USD" />
            </div>
            <div className="form-row">
              <label>DIRECTION</label>
              <div className="segmented-control small">
                <button className={manualForm.direction === 'LONG' ? 'active green' : ''} onClick={() => setManualForm({ ...manualForm, direction: 'LONG' })}>LONG</button>
                <button className={manualForm.direction === 'SHORT' ? 'active red' : ''} onClick={() => setManualForm({ ...manualForm, direction: 'SHORT' })}>SHORT</button>
              </div>
            </div>
            <div className="form-row">
              <label>ENTRY TYPE</label>
              <div className="segmented-control small">
                <button className={isMarket ? 'active' : ''} onClick={() => setManualForm({ ...manualForm, entry_type: 'market' })}>MARKET</button>
                <button className={!isMarket ? 'active' : ''} onClick={() => setManualForm({ ...manualForm, entry_type: 'limit' })}>LIMIT</button>
              </div>
            </div>
            <div className="form-row">
              <label>ENTRY PRICE</label>
              {isMarket ? (
                <div className="inp" style={{ color: 'var(--text-muted)', cursor: 'default', lineHeight: '28px' }}>FILLS AT OPEN</div>
              ) : (
                <input className="inp" type="number" step="0.01" value={manualForm.entry_price || ''} onChange={e => setManualForm({ ...manualForm, entry_price: parseFloat(e.target.value) || 0 })} />
              )}
            </div>
            <div className="form-row">
              <label>TAKE PROFIT</label>
              <input className="inp" type="number" step="0.01" value={manualForm.take_profit || ''} onChange={e => setManualForm({ ...manualForm, take_profit: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="form-row">
              <label>STOP LOSS</label>
              <input className="inp" type="number" step="0.01" value={manualForm.stop_loss ?? ''} onChange={e => setManualForm({ ...manualForm, stop_loss: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="optional" />
            </div>
            <div className="form-row">
              <label>HOLD UNTIL</label>
              <input
                className="inp"
                type="date"
                value={manualForm.holdUntil ?? ''}
                onChange={e => setManualForm({ ...manualForm, holdUntil: e.target.value || undefined })}
              />
              <span className="hint">Optional — leave blank to expire with price data.</span>
            </div>
            <div className="form-row">
              <label>ASSET TYPE</label>
              <select className="inp" value={manualForm.asset_type} onChange={e => setManualForm({ ...manualForm, asset_type: e.target.value as AssetType })}>
                <option value="equity">EQUITY</option>
                <option value="futures_commodity">FUTURES (COMMODITY)</option>
                <option value="futures_index">FUTURES (INDEX)</option>
                <option value="etf">ETF</option>
                <option value="crypto">CRYPTO</option>
              </select>
            </div>
            <div className="form-row">
              <label>MOMENTUM</label>
              <div className="segmented-control small">
                <button className={manualForm.momentum_strength === 'STRONG' ? 'active' : ''} onClick={() => setManualForm({ ...manualForm, momentum_strength: 'STRONG' })}>STRONG</button>
                <button className={manualForm.momentum_strength === 'WEAK' ? 'active' : ''} onClick={() => setManualForm({ ...manualForm, momentum_strength: 'WEAK' })}>WEAK</button>
              </div>
            </div>
            <div className="form-row">
              <label>NOTES</label>
              <textarea className="inp" rows={2} value={manualForm.notes ?? ''} onChange={e => setManualForm({ ...manualForm, notes: e.target.value })} />
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleManualSave} disabled={!manualForm.asset?.trim()}>SAVE SIGNAL</button>
          </div>
        )}
      </div>

      {/* Right panel — signal library */}
      <div className="panel signals-library-panel">
        <div className="library-header">
          <span className="panel-title">SIGNAL LIBRARY ({signals.length})</span>
          <div className="filter-row">
            <input className="inp small" placeholder="Filter asset..." value={filterAsset} onChange={e => setFilterAsset(e.target.value)} />
            <select className="inp small" value={filterDir} onChange={e => setFilterDir(e.target.value)}>
              <option value="">ALL DIR</option>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
            <select className="inp small" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">ALL STATUS</option>
              <option value="pending">PENDING</option>
              <option value="active">ACTIVE</option>
              <option value="closed_win">WIN</option>
              <option value="closed_loss">LOSS</option>
              <option value="expired">EXPIRED</option>
              <option value="unfilled">UNFILLED</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <SortHdr field="created_at" label="DATE" />
                <SortHdr field="asset" label="ASSET" />
                <SortHdr field="direction" label="DIR" />
                <th>TYPE</th>
                <SortHdr field="entry_price" label="ENTRY" />
                <th>TP</th>
                <th>SL</th>
                <th>HOLD UNTIL</th>
                <th>MOM</th>
                <SortHdr field="status" label="STATUS" />
                <SortHdr field="pnl_pct" label="P&L%" />
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                  <td className="mono dim">{i + 1}</td>
                  <td className="mono dim">{s.created_at.slice(0, 10)}</td>
                  <td className="mono bold">{s.asset}</td>
                  <td className={`mono ${s.direction === 'LONG' ? 'green' : 'red'}`}>{s.direction}</td>
                  <td className="mono dim" style={{ fontSize: 11 }}>{s.entry_type?.toUpperCase() ?? 'LIMIT'}</td>
                  <td className="mono">{s.entry_type === 'market' ? 'MKT' : formatPrice(s.entry_price, s.asset)}</td>
                  <td className="mono">{formatPrice(s.take_profit, s.asset)}</td>
                  <td className="mono dim">{s.stop_loss ? formatPrice(s.stop_loss, s.asset) : '—'}</td>
                  <td className="mono dim" style={{ fontSize: 11 }}>{s.holdUntil ?? '—'}</td>
                  <td className="mono dim" style={{ fontSize: 11 }}>{s.momentum_strength[0]}{s.momentum_direction[0]}</td>
                  <td><StatusBadge signal={s} /></td>
                  <td className={`mono ${(s.pnl_pct ?? 0) >= 0 ? 'green' : 'red'}`}>
                    {s.pnl_pct !== undefined ? formatPct(s.pnl_pct) : '—'}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-xs" onClick={() => { setEditId(s.id); setEditForm({ ...s }); }}>EDIT</button>
                      <button className="btn-xs red" onClick={() => handleDelete(s.id)}>DEL</button>
                    </div>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>NO SIGNALS — add one using the input panel</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editId && (
        <div className="modal-overlay" onClick={() => setEditId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">EDIT SIGNAL — {editForm.asset}</div>
            <div className="form-row"><label>DATE</label><input className="inp" type="date" value={editForm.created_at?.slice(0, 10) ?? ''} onChange={e => setEditForm({ ...editForm, created_at: e.target.value })} /></div>
            <div className="form-row"><label>ASSET</label><input className="inp" value={editForm.asset ?? ''} onChange={e => setEditForm({ ...editForm, asset: e.target.value.toUpperCase() })} /></div>
            <div className="form-row"><label>DIRECTION</label>
              <div className="segmented-control small">
                <button className={editForm.direction === 'LONG' ? 'active green' : ''} onClick={() => setEditForm({ ...editForm, direction: 'LONG' })}>LONG</button>
                <button className={editForm.direction === 'SHORT' ? 'active red' : ''} onClick={() => setEditForm({ ...editForm, direction: 'SHORT' })}>SHORT</button>
              </div>
            </div>
            <div className="form-row"><label>ENTRY TYPE</label>
              <div className="segmented-control small">
                <button className={editForm.entry_type === 'market' ? 'active' : ''} onClick={() => setEditForm({ ...editForm, entry_type: 'market' })}>MARKET</button>
                <button className={editForm.entry_type !== 'market' ? 'active' : ''} onClick={() => setEditForm({ ...editForm, entry_type: 'limit' })}>LIMIT</button>
              </div>
            </div>
            <div className="form-row"><label>ENTRY PRICE</label><input className="inp" type="number" value={editForm.entry_price ?? ''} onChange={e => setEditForm({ ...editForm, entry_price: parseFloat(e.target.value) })} disabled={editForm.entry_type === 'market'} /></div>
            <div className="form-row"><label>TAKE PROFIT</label><input className="inp" type="number" value={editForm.take_profit ?? ''} onChange={e => setEditForm({ ...editForm, take_profit: parseFloat(e.target.value) })} /></div>
            <div className="form-row"><label>STOP LOSS</label><input className="inp" type="number" value={editForm.stop_loss ?? ''} onChange={e => setEditForm({ ...editForm, stop_loss: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="optional" /></div>
            <div className="form-row">
              <label>HOLD UNTIL</label>
              <input
                className="inp"
                type="date"
                value={editForm.holdUntil ?? ''}
                onChange={e => setEditForm({ ...editForm, holdUntil: e.target.value || undefined })}
              />
            </div>
            <div className="form-row"><label>NOTES</label><textarea className="inp" rows={2} value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            <div className="btn-row">
              <button className="btn-primary" onClick={handleEditSave}>SAVE</button>
              <button className="btn-secondary" onClick={() => setEditId(null)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
