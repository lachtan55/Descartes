import { useState, useEffect } from 'react';

interface ConnectionState {
  connected: boolean;
  host: string | null;
  port: number | null;
}

export default function IBGatewayPanel() {
  const [form, setForm] = useState({ host: '127.0.0.1', port: 4002, clientId: 1 });
  const [status, setStatus] = useState<ConnectionState>({ connected: false, host: null, port: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll /api/ib/status every 3 s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/ib/status');
        const data = await res.json();
        setStatus(data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ib/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: form.host, port: form.port, client_id: form.clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Connection failed');
      setStatus({ connected: true, host: data.host, port: data.port });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch('/api/ib/disconnect', { method: 'POST' });
      setStatus({ connected: false, host: null, port: null });
    } finally {
      setLoading(false);
    }
  };

  const setField = (field: keyof typeof form, raw: string) => {
    const value = field === 'host' ? raw : parseInt(raw, 10) || 0;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (status.connected) {
    return (
      <div className="panel" style={{ marginBottom: 0, flexShrink: 0 }}>
        <div className="panel-header-row">
          <span className="panel-title" style={{ margin: 0 }}>IB GATEWAY</span>
          <button
            className="btn-secondary"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? 'DISCONNECTING...' : 'DISCONNECT'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--accent-green)',
            letterSpacing: '0.5px',
          }}>
            ● ONLINE
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.5px',
          }}>
            {status.host}:{status.port}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 0, flexShrink: 0 }}>
      <div className="panel-header-row">
        <span className="panel-title" style={{ margin: 0 }}>IB GATEWAY</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--accent-red)',
          letterSpacing: '0.5px',
        }}>
          ● OFFLINE
        </span>
      </div>

      <div className="form-row-inline" style={{ alignItems: 'flex-end', gap: 10 }}>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>HOST</label>
          <input
            className="inp"
            style={{ width: 160 }}
            value={form.host}
            onChange={e => setField('host', e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>PORT</label>
          <input
            className="inp"
            style={{ width: 80 }}
            value={form.port}
            onChange={e => setField('port', e.target.value)}
          />
        </div>

        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>CLIENT ID</label>
          <input
            className="inp"
            style={{ width: 60 }}
            value={form.clientId}
            onChange={e => setField('clientId', e.target.value)}
          />
        </div>

        <button
          className="btn-primary"
          onClick={handleConnect}
          disabled={loading}
          style={{ flexShrink: 0, marginBottom: 0 }}
        >
          {loading ? 'CONNECTING...' : 'CONNECT'}
        </button>
      </div>

      {error && (
        <div className="error-msg" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
