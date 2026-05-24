import React from 'react';
import type { BridgeStatusLevel } from '../types';

interface Props {
  status: BridgeStatusLevel;
  label?: string;
  small?: boolean;
  onClick?: () => void;
}

const STATUS_CONFIG: Record<BridgeStatusLevel, { color: string; dot: string; text: string }> = {
  connected:  { color: '#00c851', dot: '#00c851', text: 'LIVE' },
  stale:      { color: '#f0a500', dot: '#f0a500', text: 'STALE' },
  manual:     { color: '#5c9dff', dot: '#5c9dff', text: 'MANUAL' },
  not_built:  { color: '#555',    dot: '#444',    text: 'NOT BUILT' },
};

export default function BridgeStatusBadge({ status, label, small, onClick }: Props) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_built;
  const sz = small ? 6 : 8;

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: small ? '1px 5px' : '2px 7px',
        border: `1px solid ${cfg.color}33`,
        borderRadius: 2,
        background: `${cfg.color}10`,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--font-mono)',
        fontSize: small ? 9 : 10,
        letterSpacing: '0.06em',
        color: cfg.color,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: sz, height: sz,
        borderRadius: '50%',
        background: cfg.dot,
        boxShadow: status === 'connected' ? `0 0 4px ${cfg.dot}` : 'none',
        flexShrink: 0,
      }} />
      {label ?? cfg.text}
    </span>
  );
}
