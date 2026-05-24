import React from 'react';
import type { OutlookTable as OutlookTableData } from '../types';

interface Props {
  data: OutlookTableData | null;
  isLoading?: boolean;
  title: string;
  unit?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function OutlookTable({ data, isLoading, title, unit }: Props) {
  if (isLoading) {
    return (
      <div style={{ padding: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
        LOADING OUTLOOK DATA…
      </div>
    );
  }
  if (!data) return null;

  const { years, entries, consensus, high, low } = data;

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* table header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 6,
        paddingBottom: 4,
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--accent-amber)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        {unit && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            {unit}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          minWidth: 320,
        }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 90 }}>PROVIDER</th>
              {years.map(y => (
                <th key={y} style={{
                  ...thStyle,
                  color: parseInt(y) === CURRENT_YEAR ? 'var(--accent-amber)' : 'var(--text-muted)',
                }}>
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => (
              <tr key={entry.provider_id} style={{
                background: idx % 2 === 0 ? 'transparent' : '#0a0a0a',
                borderBottom: '1px solid #1a1a1a',
              }}>
                <td style={{
                  padding: '3px 6px',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: entry.color,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      color: entry.color,
                      fontWeight: entry.is_locked ? 600 : 400,
                    }}>
                      {entry.provider_label}
                    </span>
                    {entry.is_locked && (
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', marginLeft: 2 }}>🔒</span>
                    )}
                  </span>
                </td>
                {years.map(y => (
                  <td key={y} style={tdStyle}>
                    {entry.values[y] != null
                      ? formatVal(entry.values[y]!)
                      : <span style={{ color: '#333' }}>—</span>
                    }
                  </td>
                ))}
              </tr>
            ))}

            {/* Consensus / range rows */}
            {consensus && (
              <>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--accent-amber)', fontWeight: 600 }}>
                    CONSENSUS
                  </td>
                  {years.map(y => (
                    <td key={y} style={{ ...tdStyle, color: 'var(--accent-amber)', fontWeight: 600 }}>
                      {consensus[y] != null ? formatVal(consensus[y]!) : '—'}
                    </td>
                  ))}
                </tr>
                {high && low && (
                  <tr>
                    <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-muted)', fontSize: 9 }}>
                      HIGH / LOW
                    </td>
                    {years.map(y => (
                      <td key={y} style={{ ...tdStyle, fontSize: 9, color: 'var(--text-muted)' }}>
                        {high[y] != null && low[y] != null
                          ? `${formatVal(high[y]!)} / ${formatVal(low[y]!)}`
                          : '—'
                        }
                      </td>
                    ))}
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatVal(v: number): string {
  return v.toFixed(1);
}

const thStyle: React.CSSProperties = {
  padding: '3px 6px',
  textAlign: 'right',
  color: 'var(--text-muted)',
  fontWeight: 400,
  fontSize: 9,
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
  background: '#0a0a0a',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '3px 6px',
  textAlign: 'right',
  color: 'var(--text-primary)',
};
