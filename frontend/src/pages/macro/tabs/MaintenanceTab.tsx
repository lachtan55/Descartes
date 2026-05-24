import React, { useState, useEffect, useMemo } from 'react';
import BridgeStatusBadge from '../components/BridgeStatusBadge';
import type { BridgeStatusLevel, BridgeStatus } from '../types';

interface CatalogRow {
  id: string;
  label: string;
  region: string;
  category: string;
  frequency: string;
  source: string;
  bridgeStatus: BridgeStatusLevel;
  unit: string;
  coverageStart: number;
  lastUpdated?: string;
  active: boolean;
  dataQuality: string;
  notes?: string;
  isCore: boolean;
  chinaDisclaimer?: boolean;
}

const API = 'http://localhost:8000';

const REGION_FILTER_OPTIONS = ['ALL', 'US', 'China', 'Eurozone', 'Germany', 'Japan', 'Czechia'];
const CATEGORY_OPTIONS = ['ALL', 'gdp', 'inflation', 'rates', 'forecasts', 'custom'];
const STATUS_OPTIONS = ['ALL', 'connected', 'stale', 'manual', 'not_built'];

const QUALITY_COLORS: Record<string, string> = {
  official:    '#00c851',
  official_nbs:'#f0a500',
  estimated:   '#f0a500',
  revised:     '#5c9dff',
  preliminary: '#ff9800',
  disputed:    '#ff3d3d',
  modeled:     '#9b59b6',
};

const SOURCE_LABELS: Record<string, string> = {
  fred_api:     'FRED',
  ecb_api:      'ECB',
  worldbank_api:'WB',
  czso_api:     'CZSO',
  cnb_api:      'CNB',
  imf_weo_csv:  'IMF WEO',
  manual_upload:'MANUAL',
};

export default function MaintenanceTab() {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [bridges, setBridges] = useState<BridgeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeOnly, setActiveOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [catRes, bridgeRes] = await Promise.all([
        fetch(`${API}/api/macro/catalog`),
        fetch(`${API}/api/macro/bridge-status`),
      ]);
      if (catRes.ok) setCatalog(await catRes.json());
      if (bridgeRes.ok) setBridges(await bridgeRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return catalog.filter(row => {
      if (regionFilter !== 'ALL' && row.region !== regionFilter) return false;
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && row.bridgeStatus !== statusFilter) return false;
      if (activeOnly && !row.active) return false;
      if (search) {
        const q = search.toLowerCase();
        return row.label.toLowerCase().includes(q)
          || row.id.toLowerCase().includes(q)
          || row.source.toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalog, regionFilter, categoryFilter, statusFilter, activeOnly, search]);

  // Bridge status summary
  const connected = bridges.filter(b => b.status === 'connected').length;
  const total = bridges.length;

  const toggleActive = async (row: CatalogRow) => {
    try {
      const res = await fetch(`${API}/api/macro/catalog/${row.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      });
      if (res.ok) {
        setCatalog(prev => prev.map(r => r.id === row.id ? { ...r, active: !r.active } : r));
      }
    } catch { /* ignore */ }
  };

  const triggerRefresh = async (id: string) => {
    try {
      await fetch(`${API}/api/macro/refresh/${id}`, { method: 'POST' });
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 }}>

      {/* Bridge status banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        background: '#0a0a0a',
        border: '1px solid var(--border)',
        borderRadius: 2,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          marginRight: 6,
        }}>
          BRIDGE STATUS
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: connected > 0 ? 'var(--accent-green)' : '#555',
        }}>
          {connected}/{total} CONNECTED
        </span>
        <span style={{ flex: 1 }} />
        {bridges.map(b => (
          <div key={b.source_name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#555', textTransform: 'uppercase' }}>
              {b.source_name}
            </span>
            <BridgeStatusBadge status={b.status as BridgeStatusLevel} small />
          </div>
        ))}
        <button
          onClick={load}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            cursor: 'pointer',
            padding: '1px 6px',
            borderRadius: 2,
          }}
        >
          ↻ REFRESH
        </button>
      </div>

      {/* Filters row */}
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <input
          type="text"
          placeholder="SEARCH SERIES…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#0a0a0a',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 2,
            width: 180,
            outline: 'none',
          }}
        />
        {[
          { label: 'REGION', value: regionFilter, set: setRegionFilter, opts: REGION_FILTER_OPTIONS },
          { label: 'CATEGORY', value: categoryFilter, set: setCategoryFilter, opts: CATEGORY_OPTIONS },
          { label: 'BRIDGE', value: statusFilter, set: setStatusFilter, opts: STATUS_OPTIONS },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
              {f.label}:
            </span>
            <select
              value={f.value}
              onChange={e => f.set(e.target.value)}
              style={{
                background: '#0a0a0a',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                padding: '2px 5px',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={e => setActiveOnly(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent-amber)' }}
          />
          ACTIVE ONLY
        </label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#444', marginLeft: 'auto' }}>
          {filtered.length} / {catalog.length} SERIES
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: '20px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            LOADING CATALOG…
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
          }}>
            <thead>
              <tr style={{ background: '#0a0a0a', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={thStyle}>SERIES</th>
                <th style={thStyle}>REGION</th>
                <th style={thStyle}>CATEGORY</th>
                <th style={thStyle}>FREQ</th>
                <th style={thStyle}>SOURCE</th>
                <th style={thStyle}>BRIDGE</th>
                <th style={thStyle}>QUALITY</th>
                <th style={thStyle}>UNIT</th>
                <th style={thStyle}>COVERAGE</th>
                <th style={thStyle}>ACTIVE</th>
                <th style={thStyle}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <React.Fragment key={row.id}>
                  <tr
                    style={{
                      background: idx % 2 === 0 ? 'transparent' : '#080808',
                      borderBottom: expandedId === row.id ? 'none' : '1px solid #151515',
                      cursor: 'pointer',
                      opacity: row.active ? 1 : 0.45,
                    }}
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td style={{ ...tdStyle, maxWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {row.isCore && (
                          <span title="Core series" style={{ color: 'var(--accent-amber)', fontSize: 9 }}>◆</span>
                        )}
                        {row.chinaDisclaimer && (
                          <span title="NBS data quality disclaimer" style={{ fontSize: 9 }}>⚠</span>
                        )}
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                        }}>
                          {row.label}
                        </span>
                      </div>
                      <div style={{ color: '#444', fontSize: 8, marginTop: 1 }}>{row.id}</div>
                    </td>
                    <td style={tdStyle}>{row.region}</td>
                    <td style={{ ...tdStyle, textTransform: 'uppercase', color: '#888' }}>{row.category}</td>
                    <td style={{ ...tdStyle, color: '#666' }}>{row.frequency.replace('_based', '')}</td>
                    <td style={{ ...tdStyle, color: '#5c9dff' }}>
                      {SOURCE_LABELS[row.source] ?? row.source}
                    </td>
                    <td style={tdStyle}>
                      <BridgeStatusBadge status={row.bridgeStatus} small />
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        color: QUALITY_COLORS[row.dataQuality] ?? '#888',
                        fontSize: 9,
                      }}>
                        {row.dataQuality}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#555', maxWidth: 100 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {row.unit}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#555' }}>{row.coverageStart}–</td>
                    <td style={tdStyle}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleActive(row); }}
                        style={{
                          background: row.active ? 'rgba(0,200,81,0.1)' : '#1a1a1a',
                          border: `1px solid ${row.active ? 'var(--accent-green)' : '#333'}`,
                          color: row.active ? 'var(--accent-green)' : '#555',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 8,
                          cursor: 'pointer',
                          padding: '1px 5px',
                          borderRadius: 2,
                        }}
                      >
                        {row.active ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={e => { e.stopPropagation(); triggerRefresh(row.id); }}
                          title="Trigger refresh"
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 8,
                            cursor: row.bridgeStatus === 'not_built' ? 'not-allowed' : 'pointer',
                            padding: '1px 4px',
                            borderRadius: 2,
                            opacity: row.bridgeStatus === 'not_built' ? 0.3 : 1,
                          }}
                          disabled={row.bridgeStatus === 'not_built'}
                        >
                          ↻
                        </button>
                        <span style={{ color: '#222', fontSize: 10 }}>
                          {expandedId === row.id ? '▲' : '▼'}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === row.id && (
                    <tr style={{ background: '#0d0d0d' }}>
                      <td colSpan={11} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '8px 16px',
                          fontSize: 9,
                        }}>
                          <Detail label="SERIES ID" value={row.id} />
                          <Detail label="DATA SOURCE" value={row.source} />
                          <Detail label="DATA QUALITY" value={row.dataQuality} />
                          {row.notes && <Detail label="NOTES" value={row.notes} span={3} />}
                          <Detail label="LAST UPDATED" value={row.lastUpdated ?? '—'} />
                          <Detail label="IS CORE" value={row.isCore ? 'YES' : 'NO'} />
                          <Detail label="CHINA DISCLAIMER" value={row.chinaDisclaimer ? 'YES' : 'NO'} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

function Detail({ label, value, span }: { label: string; value: string; span?: number }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ color: '#444', fontSize: 8, marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 9 }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '5px 8px',
  textAlign: 'left',
  color: 'var(--text-muted)',
  fontWeight: 400,
  fontSize: 8,
  letterSpacing: '0.07em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  verticalAlign: 'middle',
  color: 'var(--text-primary)',
};
