import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIModelInfo, MacroReport } from '../types';

interface Props {
  region: string;
  availableModels: AIModelInfo[];
}

const API = 'http://localhost:8000';

export default function AIMacroPanel({ region, availableModels }: Props) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [report, setReport] = useState<MacroReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine default model: first available
  const activeModels = availableModels.filter(m => m.available);
  const effectiveModel = selectedModel || (activeModels[0]?.id ?? '');

  const generate = async () => {
    if (!effectiveModel) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`${API}/api/macro/ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, model: effectiveModel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? 'Failed to generate report');
      } else {
        setReport(data);
        if (data.error) setError(data.error);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
    setLoading(false);
  };

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
          AI ANALYSIS
        </span>
        <span style={{ flex: 1 }} />

        {/* model selector */}
        {activeModels.length > 0 ? (
          <select
            value={effectiveModel}
            onChange={e => setSelectedModel(e.target.value)}
            style={{
              background: '#0a0a0a',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              padding: '1px 4px',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            {activeModels.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#555' }}>
            NO AI KEY SET
          </span>
        )}

        <button
          onClick={generate}
          disabled={loading || activeModels.length === 0}
          style={{
            background: loading ? '#1a1a1a' : 'rgba(240,165,0,0.1)',
            border: '1px solid var(--accent-amber)',
            color: loading ? 'var(--text-muted)' : 'var(--accent-amber)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            cursor: loading || activeModels.length === 0 ? 'not-allowed' : 'pointer',
            padding: '2px 8px',
            borderRadius: 2,
            letterSpacing: '0.06em',
            opacity: activeModels.length === 0 ? 0.4 : 1,
          }}
        >
          {loading ? '…GENERATING' : '▶ GENERATE'}
        </button>
      </div>

      {/* content area */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '10px 12px',
        minHeight: 0,
      }}>
        {!report && !loading && !error && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: '#333',
            textAlign: 'center',
            paddingTop: 30,
            lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 18, marginBottom: 8, opacity: 0.3 }}>⬡</div>
            Click GENERATE to produce an AI macro<br />analysis for {region} using live data.
            {activeModels.length === 0 && (
              <div style={{ color: '#555', marginTop: 8 }}>
                Set ANTHROPIC_API_KEY, GEMINI_API_KEY,<br />or OPENAI_API_KEY in .env to enable.
              </div>
            )}
          </div>
        )}

        {loading && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--accent-amber)',
            textAlign: 'center',
            paddingTop: 30,
          }}>
            <div style={{ marginBottom: 8 }}>⟳ Generating analysis…</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
              Using {effectiveModel}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--accent-red)',
            background: 'rgba(255,61,61,0.06)',
            border: '1px solid rgba(255,61,61,0.2)',
            borderRadius: 2,
            padding: '8px 10px',
            marginBottom: 8,
          }}>
            ERROR: {error}
          </div>
        )}

        {report && (
          <div>
            {/* meta bar */}
            <div style={{
              display: 'flex',
              gap: 10,
              marginBottom: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              paddingBottom: 6,
              borderBottom: '1px solid var(--border)',
            }}>
              <span>{report.model}</span>
              <span>·</span>
              <span>{report.region}</span>
              <span>·</span>
              <span>{new Date(report.generated_at).toLocaleString()}</span>
            </div>

            {/* markdown content */}
            <div className="macro-ai-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {report.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
