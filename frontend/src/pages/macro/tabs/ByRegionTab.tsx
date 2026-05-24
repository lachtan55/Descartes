import React, { useEffect, useState } from 'react';
import CountryDashboard from '../components/CountryDashboard';
import type { AIModelInfo } from '../types';
import { REGIONS } from '../../../config/regionConfig';

const API = 'http://localhost:8000';

interface Props {
  initialRegion?: string;
}

export default function ByRegionTab({ initialRegion }: Props) {
  const [activeRegion, setActiveRegion] = useState(initialRegion ?? REGIONS[0].id);
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([]);

  useEffect(() => {
    // Load available AI models once
    fetch(`${API}/api/macro/ai-models`)
      .then(r => r.ok ? r.json() : [])
      .then(setAvailableModels)
      .catch(() => setAvailableModels([]));
  }, []);

  const activeRegionCfg = REGIONS.find(r => r.id === activeRegion);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
    }}>
      {/* Region tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        marginBottom: 10,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {REGIONS.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveRegion(r.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeRegion === r.id ? '2px solid var(--accent-amber)' : '2px solid transparent',
              color: activeRegion === r.id ? 'var(--accent-amber)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -1,
              transition: 'color 0.1s',
            }}
          >
            <span>{r.flag}</span>
            <span>{r.id}</span>
          </button>
        ))}
      </div>

      {/* Region header */}
      {activeRegionCfg && (
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 20 }}>{activeRegionCfg.flag}</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}>
            {activeRegionCfg.label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#444' }}>
            {activeRegionCfg.currency}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#555' }}>
            {activeRegionCfg.centralBank}
          </span>
          {activeRegionCfg.cbTarget && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#444' }}>
              target: {activeRegionCfg.cbTarget}
            </span>
          )}
        </div>
      )}

      {/* Dashboard */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <CountryDashboard
          key={activeRegion}
          region={activeRegion}
          availableModels={availableModels}
        />
      </div>
    </div>
  );
}
