import { useState, useEffect } from 'react';
import SectionShell from '../components/SectionShell';
import DatabaseTab from './documents/DatabaseTab';
import PriceDataTab from './documents/PriceDataTab';
import LoginGate from './documents/LoginGate';
import { logout, fetchDbStats, type DbStats } from '../lib/pocketbase';

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)        return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function DatabaseSection() {
  const [activeTab, setActiveTab] = useState('DATABASE');
  const [dbStats, setDbStats] = useState<DbStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const stats = await fetchDbStats();
        if (!cancelled) setDbStats(stats);
      } catch {
        // Non-critical display stat — fail silently.
      }
    };

    refresh();
    // Re-fetch every 60 s to catch uploads/deletes from this session.
    const id = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeTab]); // re-fetch whenever the user switches tabs

  const logoutBar = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '2px 12px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* ── Database size display ── */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--text-muted)',
        letterSpacing: 0.3,
      }}>
        {dbStats
          ? `${dbStats.count} DOCS · ${formatBytes(dbStats.totalBytes)}`
          : '—'}
      </span>

      <button className="btn-xs" onClick={logout}>LOGOUT</button>
    </div>
  );

  return (
    <LoginGate>
      <SectionShell
        moduleId="database"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        aboveContent={logoutBar}
      >
        {activeTab === 'DATABASE'  && <PriceDataTab />}
        {activeTab === 'DOCUMENTS' && <DatabaseTab />}
      </SectionShell>
    </LoginGate>
  );
}
