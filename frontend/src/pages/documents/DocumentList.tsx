import { useRef, useState } from 'react';
import { uploadDocument, starDocument, unstarDocument } from '../../lib/pocketbase';
import type { Document } from './types';
import { tagColor } from './taxonomy';
import UploadZone from './UploadZone';

interface Props {
  docs: Document[];
  loading: boolean;
  error: string;
  selected: Set<string>;
  onSelectChange: (s: Set<string>) => void;
  activeDocId: string | null;
  onDocClick: (d: Document) => void;
  onUpload: (d: Document) => void;
  onAutoTag: (ids: string[], provider: 'gemini' | 'claude') => void;
  onAutoTagSilent: (ids: string[], provider: 'gemini' | 'claude') => void;
  onDelete: (ids: string[]) => void;
  onDocUpdate: (d: Document) => void;   // for star/unstar updates
  taggingLoading: boolean;
  taggingDocId: string | null;
  sortBy: 'date' | 'name' | 'status';
  onSortChange: (s: 'date' | 'name' | 'status') => void;
}

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.csv,.xlsx,.txt,.md';

function StatusBadge({ status }: { status: Document['tagging_status'] }) {
  const MAP = {
    untagged:       { label: 'UNTAGGED',       color: '#FF4444' },
    pending_review: { label: 'PENDING REVIEW',  color: '#FFA500' },
    tagged:         { label: 'TAGGED',          color: '#00FF41' },
  };
  const { label, color } = MAP[status];
  return (
    <span className="db-status-badge" style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : '—';
}

export default function DocumentList({
  docs, loading, error, selected, onSelectChange, activeDocId,
  onDocClick, onUpload, onAutoTag, onAutoTagSilent, onDelete, onDocUpdate, taggingLoading, taggingDocId,
  sortBy, onSortChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [starringId, setStarringId] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'claude'>('gemini');

  const starredCount = docs.filter(d => d.starred).length;

  async function handleToggleStar(doc: Document, e: React.MouseEvent) {
    e.stopPropagation();
    if (starringId === doc.id) return;
    setStarringId(doc.id);
    try {
      const updated = doc.starred
        ? await unstarDocument(doc.id)
        : await starDocument(doc.id);
      onDocUpdate(updated);
    } catch {
      // silently ignore — star feature requires migration to be applied
    } finally {
      setStarringId(null);
    }
  }

  function toggleTagExpand(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  }

  function toggleAll() {
    if (selected.size === docs.length) onSelectChange(new Set());
    else onSelectChange(new Set(docs.map(d => d.id)));
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const doc = await uploadDocument(f);
      onUpload(doc);
    }
    e.target.value = '';
  }

  const selArray = Array.from(selected);
  const untaggedSelected = selArray.filter(id => {
    const d = docs.find(x => x.id === id);
    return d?.tagging_status === 'untagged';
  });

  return (
    <div className="db-list-container">
      <div className="db-list-toolbar">
        <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
          + UPLOAD
        </button>
        {starredCount > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-amber)', letterSpacing: 0.5 }}>
            ★ {starredCount} STARRED
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        <button
          className="btn-secondary"
          disabled={taggingLoading || untaggedSelected.length === 0}
          onClick={() => onAutoTag(untaggedSelected, aiProvider)}
          title={`Auto-tag ${untaggedSelected.length} selected untagged document(s) with ${aiProvider === 'gemini' ? 'Gemini Flash Lite' : 'Claude Haiku'}`}
        >
          {taggingLoading
            ? 'TAGGING...'
            : untaggedSelected.length > 1
              ? `AUTO-TAG (${untaggedSelected.length})`
              : 'AUTO-TAG'}
        </button>

        <button
          className="btn-secondary"
          disabled={taggingLoading || untaggedSelected.length === 0}
          onClick={() => onAutoTagSilent(untaggedSelected, aiProvider)}
          title={`Auto-tag and save ${untaggedSelected.length} document(s) automatically — skips review, saves tags with confidence ≥ 50%`}
          style={{ opacity: 0.85 }}
        >
          {untaggedSelected.length > 1
            ? `AUTO-SAVE (${untaggedSelected.length})`
            : 'AUTO-SAVE'}
        </button>

        <div style={{
          display: 'inline-flex',
          border: '1px solid var(--border)',
          borderRadius: 2,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {(['gemini', 'claude'] as const).map(p => (
            <button
              key={p}
              disabled={taggingLoading}
              onClick={() => setAiProvider(p)}
              style={{
                background: aiProvider === p ? 'var(--accent-amber)' : 'var(--bg-secondary)',
                color: aiProvider === p ? '#0d0d0d' : 'var(--text-secondary)',
                border: 'none',
                borderLeft: p === 'claude' ? '1px solid var(--border)' : 'none',
                padding: '3px 8px',
                cursor: taggingLoading ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.5px',
              }}
            >
              {p === 'gemini' ? 'GEMINI FLASH LITE' : 'CLAUDE HAIKU'}
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <button className="btn-xs red" onClick={() => onDelete(selArray)}>
            DELETE ({selected.size})
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SORT:</span>
          {(['date', 'name', 'status'] as const).map(s => (
            <button key={s} className={`btn-xs${sortBy === s ? ' amber' : ''}`} onClick={() => onSortChange(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <UploadZone onUpload={onUpload} />

      <div className="db-list-scroll">
        {loading && <div className="empty-msg">LOADING...</div>}
        {error && <div className="error-msg">{error}</div>}
        {!loading && !error && docs.length === 0 && (
          <div className="empty-msg">No documents. Upload files to get started.</div>
        )}

        {docs.length > 0 && (
          <table className="data-table db-doc-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === docs.length && docs.length > 0}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--accent-amber)' }}
                  />
                </th>
                <th>DOCUMENT</th>
                <th style={{ width: 28, textAlign: 'center' }} title="Star for Macroeconomics">★</th>
                <th>STATUS</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => {
                const isActive = doc.id === activeDocId;
                const isTagging = doc.id === taggingDocId && taggingLoading;
                return (
                  <tr
                    key={doc.id}
                    className={i % 2 === 0 ? 'row-even' : 'row-odd'}
                    style={{
                      cursor: 'pointer',
                      outline: isActive ? '1px solid var(--accent-amber)' : undefined,
                      opacity: isTagging ? 0.6 : 1,
                    }}
                    onClick={() => onDocClick(doc)}
                  >
                    <td onClick={e => { e.stopPropagation(); toggleSelect(doc.id); }}>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        style={{ accentColor: 'var(--accent-amber)' }}
                      />
                    </td>
                    <td>
                      <div className="db-doc-filename">
                        {isTagging && <span style={{ color: 'var(--accent-amber)' }}>⟳ </span>}
                        {doc.title || doc.filename}
                      </div>
                      <div className="db-doc-meta">
                        <span className="db-file-ext">{doc.file_type.toUpperCase()}</span>
                        <span>{formatBytes(doc.file_size_bytes)}</span>
                        <span>{formatDate(doc.created)}</span>
                      </div>
                      {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                        <div className="db-tag-row">
                          {(expandedTags.has(doc.id) ? doc.tags : doc.tags.slice(0, 4)).map((tag, ti) => (
                            <span
                              key={ti}
                              className="db-tag-chip"
                              style={{ borderColor: tagColor(tag.category), color: tagColor(tag.category) }}
                            >
                              {tag.value}
                            </span>
                          ))}
                          {doc.tags.length > 4 && (
                            <span
                              className="db-tag-chip"
                              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', cursor: 'pointer' }}
                              onClick={e => toggleTagExpand(doc.id, e)}
                            >
                              {expandedTags.has(doc.id) ? '« less' : `+${doc.tags.length - 4}`}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      onClick={e => handleToggleStar(doc, e)}
                      style={{ textAlign: 'center', cursor: 'pointer', fontSize: 14, userSelect: 'none' }}
                      title={doc.starred ? 'Unstar (remove from Macro highlights)' : 'Star (show in Macroeconomics)'}
                    >
                      <span style={{
                        color: doc.starred ? 'var(--accent-amber)' : 'var(--text-muted)',
                        opacity: starringId === doc.id ? 0.4 : 1,
                      }}>
                        {doc.starred ? '★' : '☆'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={doc.tagging_status} />
                    </td>
                    <td
                      onClick={e => e.stopPropagation()}
                      style={{ textAlign: 'center' }}
                    >
                      <button
                        className="btn-xs red"
                        title={`Delete ${doc.filename}`}
                        onClick={() => onDelete([doc.id])}
                      >
                        DEL
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
