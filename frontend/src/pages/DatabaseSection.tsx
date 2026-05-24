import { useState } from 'react';
import SectionShell from '../components/SectionShell';
import DatabaseTab from './documents/DatabaseTab';
import PriceDataTab from './documents/PriceDataTab';
import LoginGate from './documents/LoginGate';
import { logout } from '../lib/pocketbase';

export default function DatabaseSection() {
  const [activeTab, setActiveTab] = useState('DATABASE');

  const logoutBar = (
    <div style={{
      display: 'flex', justifyContent: 'flex-end',
      padding: '2px 12px', background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
    }}>
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
