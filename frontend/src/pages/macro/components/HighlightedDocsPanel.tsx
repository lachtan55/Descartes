import React, { useEffect, useState } from 'react';
import type { HighlightedDocument } from '../types';
import type { Document as PBDocument } from '../../documents/types';
import { fetchStarredDocuments } from '../../../lib/pocketbase';

interface Props {
  region: string;
}

const TYPE_COLORS: Record<string, string> = {
  research_report: '#5c9dff',
  thesis:          '#9b59b6',
  macro_data:      '#f0a500',
  notes:           '#00c851',
  news:            '#ff6a00',
};

export default function HighlightedDocsPanel({ region }: Props) {
  const [docs, setDocs] = useState<HighlightedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchStarredDocuments(region);
      // Map pocketbase docs to HighlightedDocument shape
      const mapped: HighlightedDocument[] = result.map((d: PBDocument) => ({
        id: d.id,
        title: d.title,
        data_type: (d as PBDocument & { data_type?: string }).data_type ?? d.file_type,
        starred_at: d.starred_at ?? undefined,
        tags: d.tags as unknown as Record<string, unknown>[],
        file_url: d.file
          ? `http://localhost:8090/api/files/documents/${d.id}/${d.file}`
          : undefined,
      }));
      setDocs(mapped);
    } catch {
      setDocs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [region]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderBottom: '1px solid var(--border)',
        background: '#111',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--accent-amber)',
          letterSpacing: '0.05em',
        }}>
          ★ HIGHLIGHTED DOCS
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          {region}
        </span>
        <button
          onClick={load}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            cursor: 'pointer',
            padding: '1px 5px',
            borderRadius: 2,
          }}
        >
          ↻
        </button>
      </div>

      {/* list */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {loading && (
          <div style={{
            padding: '12px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            LOADING…
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div style={{
            padding: '16px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: '#333',
            textAlign: 'center',
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 16, marginBottom: 6, opacity: 0.3 }}>★</div>
            No starred docs for {region}.<br />
            <span style={{ fontSize: 9 }}>
              Star documents in the Database tab<br />
              with a MACRO tag matching this region.
            </span>
          </div>
        )}

        {!loading && docs.map(doc => (
          <div
            key={doc.id}
            style={{
              padding: '7px 10px',
              borderBottom: '1px solid #1a1a1a',
              cursor: doc.file_url ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (doc.file_url) window.open(doc.file_url, '_blank');
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
            }}>
              {/* type badge */}
              <span style={{
                display: 'inline-block',
                padding: '1px 4px',
                background: `${TYPE_COLORS[doc.data_type ?? ''] ?? '#444'}22`,
                border: `1px solid ${TYPE_COLORS[doc.data_type ?? ''] ?? '#444'}44`,
                borderRadius: 2,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                color: TYPE_COLORS[doc.data_type ?? ''] ?? '#888',
                letterSpacing: '0.04em',
                flexShrink: 0,
                marginTop: 1,
              }}>
                {(doc.data_type ?? '').replace('_', ' ').toUpperCase()}
              </span>

              {/* title */}
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                color: doc.file_url ? 'var(--text-primary)' : 'var(--text-muted)',
                lineHeight: 1.3,
              }}>
                {doc.title}
                {doc.file_url && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 9 }}>↗</span>
                )}
              </span>
            </div>

            {doc.starred_at && (
              <div style={{
                marginTop: 3,
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                color: '#333',
              }}>
                STARRED {new Date(doc.starred_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
