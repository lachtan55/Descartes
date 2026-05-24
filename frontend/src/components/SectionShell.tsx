import { useState, useEffect, Component, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULES, ModuleConfig } from '../config/modules';
import { useHealth } from '../context/HealthContext';

class ErrorBoundary extends Component<
  { children: ReactNode; tabKey: string },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  componentDidUpdate(prev: { tabKey: string }) {
    if (prev.tabKey !== this.props.tabKey) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)', background: 'var(--bg-primary)' }}>
        <div style={{ marginBottom: 8, fontSize: 13 }}>RENDER ERROR</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 16 }}>{this.state.error}</div>
        <button className="btn-secondary" onClick={() => this.setState({ error: null })}>RETRY</button>
      </div>
    );
    return this.props.children;
  }
}

interface SectionShellProps {
  moduleId: string;
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
  aboveContent?: ReactNode;
  /** Extra element(s) rendered right of the status indicators */
  extraStatus?: ReactNode;
}

export default function SectionShell({ moduleId, activeTab, onTabChange, children, aboveContent, extraStatus }: SectionShellProps) {
  const navigate = useNavigate();
  const health = useHealth();
  const [clock, setClock] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const module = MODULES.find((m: ModuleConfig) => m.id === moduleId)!;

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Show banner when either service comes back online (re-open it after recovery)
  useEffect(() => {
    if (health.backend === 'online' && health.pocketbase === 'online') {
      setBannerDismissed(false);
    }
  }, [health.backend, health.pocketbase]);

  const backendOnline = health.backend === 'online';
  const anyOffline = health.backend === 'offline' || health.pocketbase === 'offline';
  const showBanner = anyOffline && !bannerDismissed;

  const offlineServices: string[] = [];
  if (health.backend === 'offline') offlineServices.push('Backend (:8000)');
  if (health.pocketbase === 'offline') offlineServices.push('PocketBase (:8090)');

  return (
    <div className="app-container">
      <header className="top-bar">
        <button className="btn-secondary" onClick={() => navigate('/')}>← HUB</button>
        <span className="app-title">DESCARTES</span>
        <nav className="tab-nav" aria-label={`${module.label} navigation`}>
          {module.tabs.map(tab =>
            tab.separator ? (
              <span key={tab.id} className="tab-separator" aria-hidden="true" />
            ) : (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => onTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          )}
        </nav>
        <div className="top-bar-right">
          <span className={`backend-status ${backendOnline ? 'online' : health.backend === 'offline' ? 'offline' : 'checking'}`}>
            {backendOnline ? '● BACKEND ONLINE' : health.backend === 'offline' ? '● BACKEND OFFLINE' : '● CHECKING...'}
          </span>
          {extraStatus}
          <span className="clock">{clock}</span>
        </div>
      </header>

      {/* Non-blocking offline banner — amber, dismissible, never gates content */}
      {showBanner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
          background: '#1a1400',
          borderBottom: '1px solid var(--accent-amber)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--accent-amber)',
          flexShrink: 0,
        }}>
          <span style={{ opacity: 0.7 }}>▲</span>
          <span>
            {offlineServices.join(' and ')} offline — data may be unavailable.
            Check that all three processes are running (PocketBase, FastAPI, Vite).
          </span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setBannerDismissed(true)}
            style={{
              background: 'none',
              border: '1px solid var(--accent-amber)',
              color: 'var(--accent-amber)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              cursor: 'pointer',
              padding: '1px 6px',
              borderRadius: 2,
              opacity: 0.7,
            }}
          >
            DISMISS
          </button>
        </div>
      )}

      {aboveContent}

      <main className="main-content">
        <ErrorBoundary tabKey={activeTab}>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
