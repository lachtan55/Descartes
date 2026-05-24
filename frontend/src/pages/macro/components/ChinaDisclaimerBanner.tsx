import React from 'react';

export default function ChinaDisclaimerBanner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '7px 12px',
      background: 'rgba(240,165,0,0.07)',
      border: '1px solid rgba(240,165,0,0.25)',
      borderRadius: 2,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: 'var(--accent-amber)',
      lineHeight: 1.5,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>⚠</span>
      <span>
        <strong>DATA QUALITY NOTICE</strong> — Chinese economic data is reported by the
        National Bureau of Statistics (NBS) and may not fully reflect independent estimates.
        GDP figures are official NBS statistics; quality classification:{' '}
        <span style={{ color: '#ff6a00' }}>official_nbs</span>.
        Cross-reference with IMF WEO, World Bank, and independent analyst estimates where available.
        Data revisions are infrequent; treat preliminary releases with appropriate caution.
      </span>
    </div>
  );
}
