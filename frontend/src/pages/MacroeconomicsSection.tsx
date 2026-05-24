import { useState, useEffect } from 'react';
import SectionShell from '../components/SectionShell';
import MaintenanceTab from './macro/tabs/MaintenanceTab';
import ByRegionTab from './macro/tabs/ByRegionTab';
import AlphaTab from './macro/tabs/AlphaTab';
import BridgeStatusBadge from './macro/components/BridgeStatusBadge';
import type { BridgeStatus, BridgeStatusLevel } from './macro/types';

const API = 'http://localhost:8000';
type TabId = 'MAINTENANCE' | 'BY_REGION' | 'ALPHA';

/** Compute aggregate bridge health from all bridges */
function aggregateBridgeStatus(bridges: BridgeStatus[]): BridgeStatusLevel {
  if (!bridges.length) return 'not_built';
  const levels = bridges.map(b => b.status);
  if (levels.some(l => l === 'connected')) return 'connected';
  if (levels.some(l => l === 'stale'))     return 'stale';
  if (levels.some(l => l === 'manual'))    return 'manual';
  return 'not_built';
}

export default function MacroeconomicsSection() {
  const [activeTab, setActiveTab] = useState<TabId>('MAINTENANCE');
  const [bridges, setBridges] = useState<BridgeStatus[]>([]);
  const [bridgeAgg, setBridgeAgg] = useState<BridgeStatusLevel>('not_built');

  useEffect(() => {
    fetch(`${API}/api/macro/bridge-status`)
      .then(r => r.ok ? r.json() : [])
      .then((data: BridgeStatus[]) => {
        setBridges(data);
        setBridgeAgg(aggregateBridgeStatus(data));
      })
      .catch(() => { /* backend may not be running yet */ });
  }, []);

  const bridgeIndicator = (
    <BridgeStatusBadge
      status={bridgeAgg}
      label={`BRIDGES ${bridges.filter(b => b.status === 'connected').length}/${bridges.length}`}
      small
    />
  );

  return (
    <SectionShell
      moduleId="macroeconomics"
      activeTab={activeTab}
      onTabChange={id => setActiveTab(id as TabId)}
      extraStatus={bridges.length > 0 ? bridgeIndicator : undefined}
    >
      <div style={{
        height: 'calc(100vh - 52px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px',
        boxSizing: 'border-box',
      }}>
        {activeTab === 'MAINTENANCE' && <MaintenanceTab />}
        {activeTab === 'BY_REGION'   && <ByRegionTab />}
        {activeTab === 'ALPHA'       && (
          <div style={{ overflow: 'auto', flex: 1 }}>
            <AlphaTab />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
