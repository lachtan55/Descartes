import { useState } from 'react';
import { saveTags } from '../../lib/pocketbase';
import type { Document, GeminiResult, TagSuggestion } from './types';
import { tagColor } from './taxonomy';

interface Props {
  doc: Document;
  result: GeminiResult;
  onSaved: (doc: Document) => void;
  onClose: () => void;
  queueIndex?: number;
  queueTotal?: number;
}

interface TagRow extends TagSuggestion {
  enabled: boolean;
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <span className="db-confidence-wrap">
      <span className="db-confidence-bar">
        <span className="db-confidence-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="db-confidence-pct">{pct}%</span>
    </span>
  );
}

export default function TagReviewModal({ doc, result, onSaved, onClose, queueIndex, queueTotal }: Props) {
  const [title, setTitle] = useState(result.suggested_title || doc.title || doc.filename);
  const [rows, setRows] = useState<TagRow[]>(
    result.tags.map(t => ({ ...t, enabled: t.confidence >= 0.5 }))
  );
  const [customCat, setCustomCat] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(idx: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }

  function addCustom() {
    const cat = customCat.trim().toLowerCase();
    const val = customVal.trim();
    if (!cat || !val) return;
    setRows(prev => [...prev, { category: cat, value: val, confidence: 1, enabled: true }]);
    setCustomCat('');
    setCustomVal('');
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const tags = rows.filter(r => r.enabled).map(({ category, value }) => ({ category, value }));
      const updated = await saveTags(doc.id, tags, title, result.summary, result.gemini_raw_response);
      onSaved(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal db-review-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          AUTO-TAG REVIEW
          {queueTotal && queueTotal > 1 ? ` (${queueIndex}/${queueTotal})` : ''}
          {' — '}{doc.filename}
        </div>

        {result.summary && (
          <div className="db-review-summary">{result.summary}</div>
        )}

        <div className="form-row" style={{ marginBottom: 12 }}>
          <label>TITLE</label>
          <input
            className="inp"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="db-review-section-label">SUGGESTED TAGS</div>

        <div className="db-review-tags">
          {rows.map((row, i) => (
            <div key={i} className={`db-review-row${row.enabled ? '' : ' disabled'}`}>
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={() => toggle(i)}
                style={{ accentColor: 'var(--accent-amber)', flexShrink: 0 }}
              />
              <span
                className="db-tag-chip db-review-tag"
                style={{
                  borderColor: tagColor(row.category),
                  color: row.enabled ? tagColor(row.category) : 'var(--text-muted)',
                }}
              >
                {row.category}:{row.value}
              </span>
              <ConfidenceBar confidence={row.confidence} />
              <button className="btn-xs red" onClick={() => removeRow(i)} style={{ marginLeft: 'auto' }}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="db-add-custom-row">
          <input
            className="inp"
            style={{ width: 100 }}
            placeholder="category"
            value={customCat}
            onChange={e => setCustomCat(e.target.value)}
          />
          <input
            className="inp"
            style={{ width: 140 }}
            placeholder="value"
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
          />
          <button className="btn-xs" onClick={addCustom}>+ ADD TAG</button>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 8 }}>{error}</div>}

        <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>CANCEL</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving
              ? 'SAVING...'
              : queueTotal && queueTotal > 1 && queueIndex! < queueTotal
                ? `SAVE & NEXT (${queueIndex! + 1}/${queueTotal}) →`
                : 'CONFIRM & SAVE TAGS'}
          </button>
        </div>
      </div>
    </div>
  );
}
