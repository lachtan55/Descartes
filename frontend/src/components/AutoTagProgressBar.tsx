/**
 * AutoTagProgressBar — shown as a flex child inside SectionShell whenever
 * there are active or recently-finished tagging jobs in AutoTagContext.
 * Collapses completely (returns null) when the jobs list is empty.
 */

import { useState } from 'react';
import { useAutoTag } from '../context/AutoTagContext';

export default function AutoTagProgressBar() {
  const { jobs, clearCompleted } = useAutoTag();
  const [showErrors, setShowErrors] = useState(false);

  if (jobs.length === 0) return null;

  const activeJob   = jobs.find(j => j.status === 'processing' || j.status === 'pending_review');
  const queuedCount = jobs.filter(j => j.status === 'queued').length;
  const doneCount   = jobs.filter(j => j.status === 'done').length;
  const errorJobs   = jobs.filter(j => j.status === 'error');
  const reviewCount = jobs.filter(j => j.status === 'pending_review').length;
  const allSettled  = jobs.every(j => j.status === 'done' || j.status === 'error');

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            10,
      padding:        '0 14px',
      height:         32,
      background:     '#0d1700',
      borderBottom:   '1px solid #1a3300',
      fontFamily:     'var(--font-mono)',
      fontSize:       10,
      flexShrink:     0,
      position:       'relative',
      zIndex:         50,
    }}>

      {/* ── Label ──────────────────────────────────────────────────────────── */}
      <span style={{ color: 'var(--accent-amber)', fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
        AUTO-TAG
      </span>

      {/* ── Active-job indicator ───────────────────────────────────────────── */}
      {activeJob ? (
        <span style={{
          display:    'flex',
          alignItems: 'center',
          gap:        5,
          color:      'var(--text-secondary)',
          minWidth:   0,
        }}>
          {activeJob.status === 'processing' ? (
            <span style={{
              display:   'inline-block',
              animation: 'spin 1s linear infinite',
              color:     'var(--accent-amber)',
              flexShrink: 0,
            }}>
              ⟳
            </span>
          ) : (
            /* pending_review */
            <span style={{ color: 'var(--accent-amber)', flexShrink: 0 }}>⏸</span>
          )}
          <span style={{
            maxWidth:     260,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {activeJob.fileName}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 9, flexShrink: 0 }}>
            [{activeJob.provider === 'gemini' ? 'GEMINI' : 'CLAUDE'}]
          </span>
          {activeJob.status === 'pending_review' && (
            <span style={{ color: 'var(--accent-amber)', fontSize: 9, flexShrink: 0 }}>
              AWAITING REVIEW
            </span>
          )}
        </span>
      ) : allSettled ? (
        <span style={{ color: 'var(--accent-green)', fontSize: 9 }}>DONE</span>
      ) : null}

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>|</span>

      {/* ── Counts ─────────────────────────────────────────────────────────── */}
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        {doneCount}/{jobs.length}
        {queuedCount > 0  && <span style={{ color: 'var(--text-secondary)' }}> · {queuedCount} queued</span>}
        {reviewCount > 0  && <span style={{ color: 'var(--accent-amber)' }}>   · {reviewCount} pending review</span>}
      </span>

      {/* ── Error badge ────────────────────────────────────────────────────── */}
      {errorJobs.length > 0 && (
        <button
          onClick={() => setShowErrors(v => !v)}
          style={{
            background:  'none',
            border:      '1px solid var(--accent-red)',
            color:       'var(--accent-red)',
            fontFamily:  'var(--font-mono)',
            fontSize:    9,
            cursor:      'pointer',
            padding:     '1px 5px',
            borderRadius: 2,
            flexShrink:  0,
          }}
        >
          {errorJobs.length} FAILED {showErrors ? '▲' : '▼'}
        </button>
      )}

      <span style={{ flex: 1 }} />

      {/* ── Clear button (only when everything is settled) ─────────────────── */}
      {allSettled && (
        <button
          onClick={() => { setShowErrors(false); clearCompleted(); }}
          style={{
            background:  'none',
            border:      '1px solid var(--border)',
            color:       'var(--text-muted)',
            fontFamily:  'var(--font-mono)',
            fontSize:    9,
            cursor:      'pointer',
            padding:     '1px 5px',
            borderRadius: 2,
            flexShrink:  0,
          }}
        >
          ✕ CLEAR
        </button>
      )}

      {/* ── Error dropdown ─────────────────────────────────────────────────── */}
      {showErrors && errorJobs.length > 0 && (
        <div style={{
          position:     'absolute',
          top:          32,
          left:         0,
          right:        0,
          background:   '#1a0000',
          borderBottom: '1px solid #3d0000',
          zIndex:       100,
          padding:      '6px 14px',
          maxHeight:    160,
          overflowY:    'auto',
        }}>
          {errorJobs.map(j => (
            <div
              key={j.id}
              style={{
                display:    'flex',
                gap:        8,
                alignItems: 'baseline',
                padding:    '3px 0',
                borderBottom: '1px solid #280000',
              }}
            >
              <span style={{ color: 'var(--accent-red)', fontSize: 9, flexShrink: 0 }}>✕</span>
              <span style={{
                color:        'var(--text-secondary)',
                fontSize:     10,
                flexShrink:   0,
                maxWidth:     220,
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}>
                {j.fileName}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-ui)' }}>
                {j.error ?? 'Unknown error'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
