import React, { useState } from 'react';
import GDPSection from './GDPSection';
import CPISection from './CPISection';
import InterestRatesSection from './InterestRatesSection';
import RightColumnPanel from './RightColumnPanel';
import ChinaDisclaimerBanner from './ChinaDisclaimerBanner';
import type { AIModelInfo } from '../types';
import { REGION_MAP } from '../../../config/regionConfig';

interface Props {
  region: string;
  availableModels: AIModelInfo[];
}

type LeftTab = 'gdp' | 'cpi' | 'rates';

const LEFT_TABS: Array<{ id: LeftTab; label: string }> = [
  { id: 'gdp',   label: 'GDP' },
  { id: 'cpi',   label: 'INFLATION' },
  { id: 'rates', label: 'RATES' },
];

export default function CountryDashboard({ region, availableModels }: Props) {
  const [leftTab, setLeftTab] = useState<LeftTab>('gdp');
  const regionCfg = REGION_MAP[region];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height: '100%',
      minHeight: 0,
    }}>
      {/* China disclaimer — permanent, non-dismissible */}
      {regionCfg?.hasChDisclaimer && <ChinaDisclaimerBanner />}

      {/* main 2-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '65fr 35fr',
        gap: 10,
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* LEFT COLUMN — charts */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Sub-tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            marginBottom: 8,
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {LEFT_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setLeftTab(t.id)}
                style={{
                  padding: '4px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: leftTab === t.id ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: leftTab === t.id ? 'var(--accent-amber)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'color 0.1s',
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Chart content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {leftTab === 'gdp'   && <GDPSection region={region} />}
            {leftTab === 'cpi'   && <CPISection region={region} />}
            {leftTab === 'rates' && <InterestRatesSection region={region} />}
          </div>
        </div>

        {/* RIGHT COLUMN — AI report + highlighted docs */}
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          <RightColumnPanel region={region} availableModels={availableModels} />
        </div>
      </div>
    </div>
  );
}
