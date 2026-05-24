import React from 'react';
import { ALPHA_INDEX_SECTIONS, ALPHA_INDICATORS } from '../../../config/alphaIndicators';

const SECTION_FLAGS: Record<string, string> = {
  sp500:  '🇺🇸',
  dax:    '🇩🇪',
  nikkei: '🇯🇵',
  china:  '🇨🇳',
  world:  '🌐',
};

const SECTION_DESC: Record<string, string> = {
  sp500:  'S&P 500 macro factor scores',
  dax:    'DAX macro factor scores',
  nikkei: 'Nikkei 225 macro factor scores',
  china:  'China equity macro factor scores',
  world:  'Global cross-regional macro scores',
};

export default function AlphaTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* header notice */}
      <div style={{
        padding: '8px 12px',
        background: 'rgba(92,157,255,0.06)',
        border: '1px solid rgba(92,157,255,0.2)',
        borderRadius: 2,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: '#5c9dff',
        lineHeight: 1.5,
      }}>
        <strong>ALPHA — UNDER CONSTRUCTION</strong>&nbsp;·&nbsp;
        Phase 5 feature. Indicator cards will display quantitative signals,
        factor scores, and cross-asset alpha readings for equity indices.
        Currently showing placeholder structure only.
      </div>

      {/* index sections */}
      {ALPHA_INDEX_SECTIONS.map(section => {
        const indicators = ALPHA_INDICATORS.filter(i => i.indexSection === section.id);
        return (
          <div key={section.id}>
            {/* section header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
              paddingBottom: 5,
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 16 }}>{SECTION_FLAGS[section.id] ?? '📊'}</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--accent-amber)',
                letterSpacing: '0.04em',
              }}>
                {section.label}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: '#444',
              }}>
                {SECTION_DESC[section.id] ?? ''}
              </span>
            </div>

            {/* indicator card grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
            }}>
              {indicators.map(ind => (
                <div
                  key={ind.id}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 2,
                    padding: '10px 12px',
                    opacity: 0.65,
                    cursor: 'not-allowed',
                  }}
                >
                  {/* placeholder shimmer indicator */}
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.05em',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                  }}>
                    {ind.label}
                  </div>

                  {/* value placeholder */}
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    color: '#2a2a2a',
                    fontWeight: 700,
                    marginBottom: 4,
                  }}>
                    —
                  </div>

                  {/* category + phase label */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: '#333',
                      textTransform: 'uppercase',
                    }}>
                      {ind.indexSection}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 7,
                      color: '#222',
                      padding: '1px 4px',
                      border: '1px solid #1a1a1a',
                      borderRadius: 2,
                    }}>
                      PH.5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
