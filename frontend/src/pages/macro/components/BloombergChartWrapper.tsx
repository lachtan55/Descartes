import React, { useState } from 'react';
import { TIMEFRAMES, type Timeframe } from '../utils/timeframe';

interface Props {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  children: React.ReactNode;
  height?: number;
  /** Pass to show the timeframe button strip in the header. */
  selectedTimeframe?: Timeframe;
  onTimeframeChange?: (tf: Timeframe) => void;
}

export default function BloombergChartWrapper({
  title, subtitle, onRefresh, isLoading, children, height = 220,
  selectedTimeframe, onTimeframeChange,
}: Props) {
  const [refreshHovered, setRefreshHovered] = useState(false);

  return (
    <div
      className="bloomberg-chart-wrapper"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* ── header bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 10px',
        borderBottom: '1px solid var(--border)',
        background: '#111',
        gap: 8,
      }}>
        {/* left: title + subtitle */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-amber)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {title}
          </span>
          {subtitle && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
            }}>
              {subtitle}
            </span>
          )}
        </div>

        {/* right: timeframe strip + loading + refresh */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>

          {/* timeframe buttons */}
          {onTimeframeChange && (
            <>
              {TIMEFRAMES.map(tf => {
                const active = tf === selectedTimeframe;
                return (
                  <button
                    key={tf}
                    onClick={() => onTimeframeChange(tf)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: active
                        ? '1px solid var(--accent-amber)'
                        : '1px solid transparent',
                      color: active ? 'var(--accent-amber)' : '#555',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      cursor: 'pointer',
                      padding: '0 4px',
                      lineHeight: '16px',
                      letterSpacing: '0.03em',
                      transition: 'color 0.1s',
                      borderRadius: 0,
                    }}
                    onMouseEnter={e => {
                      if (!active) (e.target as HTMLElement).style.color = '#999';
                    }}
                    onMouseLeave={e => {
                      if (!active) (e.target as HTMLElement).style.color = '#555';
                    }}
                  >
                    {tf}
                  </button>
                );
              })}

              {/* divider between timeframes and refresh */}
              <span style={{
                color: '#333',
                fontSize: 10,
                margin: '0 4px',
                userSelect: 'none',
              }}>
                │
              </span>
            </>
          )}

          {isLoading && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--accent-amber)',
              animation: 'pulse 1s infinite',
              marginRight: 2,
            }}>
              LOADING…
            </span>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              onMouseEnter={() => setRefreshHovered(true)}
              onMouseLeave={() => setRefreshHovered(false)}
              style={{
                background: 'none',
                border: `1px solid ${refreshHovered ? 'var(--accent-amber)' : 'var(--border)'}`,
                color: refreshHovered ? 'var(--accent-amber)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                cursor: 'pointer',
                padding: '1px 6px',
                borderRadius: 2,
                letterSpacing: '0.06em',
                transition: 'all 0.1s',
              }}
            >
              ↻ REFRESH
            </button>
          )}
        </div>
      </div>

      {/* ── chart area ──────────────────────────────────────────────────── */}
      <div style={{ height, padding: '8px 4px 4px 0' }}>
        {children}
      </div>
    </div>
  );
}
