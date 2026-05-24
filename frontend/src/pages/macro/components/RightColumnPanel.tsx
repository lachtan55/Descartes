import React, { useState, useRef, useCallback } from 'react';
import AIMacroPanel from './AIMacroPanel';
import HighlightedDocsPanel from './HighlightedDocsPanel';
import type { AIModelInfo } from '../types';

interface Props {
  region: string;
  availableModels: AIModelInfo[];
}

const MIN_TOP_PCT = 20;
const MAX_TOP_PCT = 80;
const DEFAULT_TOP_PCT = 55;

export default function RightColumnPanel({ region, availableModels }: Props) {
  const [topPct, setTopPct] = useState(DEFAULT_TOP_PCT);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopPct(Math.max(MIN_TOP_PCT, Math.min(MAX_TOP_PCT, pct)));
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        userSelect: dragging ? 'none' : 'auto',
      }}
    >
      {/* Top panel: AI */}
      <div style={{
        height: `${topPct}%`,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 2,
      }}>
        <AIMacroPanel region={region} availableModels={availableModels} />
      </div>

      {/* Draggable splitter */}
      <div
        onMouseDown={onMouseDown}
        style={{
          height: 6,
          cursor: 'ns-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: dragging ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}
      >
        <div style={{
          width: 32,
          height: 2,
          background: dragging ? 'var(--accent-amber)' : 'var(--border)',
          borderRadius: 1,
        }} />
      </div>

      {/* Bottom panel: Highlighted Docs */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 2,
      }}>
        <HighlightedDocsPanel region={region} />
      </div>
    </div>
  );
}
