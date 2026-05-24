import { useState, useEffect, ReactNode } from 'react';
import { pb, login, isAuthenticated } from '../../lib/pocketbase';

interface Props { children: ReactNode }

export default function LoginGate({ children }: Props) {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return pb.authStore.onChange(() => setAuthed(pb.authStore.isValid));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      setAuthed(true);
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  if (authed) return <>{children}</>;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-primary)',
    }}>
      <div style={{ width: 320 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          letterSpacing: 2, color: 'var(--accent-amber)', marginBottom: 24,
          textAlign: 'center',
        }}>
          DESCARTES // DATABASE
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-row">
            <label>EMAIL</label>
            <input
              className="inp"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-row">
            <label>PASSWORD</label>
            <input
              className="inp"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>

        <div style={{
          marginTop: 16, textAlign: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        }}>
          Connected to: {import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090'}
        </div>
      </div>
    </div>
  );
}
