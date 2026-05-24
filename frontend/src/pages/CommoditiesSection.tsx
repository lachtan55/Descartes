import React, { useState } from 'react';
import SectionShell from '../components/SectionShell';
import { MODULES, TabConfig } from '../config/modules';

const module = MODULES.find(m => m.id === 'commodities')!;

function PlaceholderTab({ tab }: { tab: TabConfig }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      letterSpacing: '2px',
    }}>
      — {tab.label} — COMING SOON —
    </div>
  );
}

// LIVE PRICE tab moved to Live Trading page
const TAB_COMPONENTS: Record<string, () => React.ReactElement> = {
  // ─── ADD NEW TAB COMPONENTS HERE ───
};

export default function CommoditiesSection() {
  const [activeTab, setActiveTab] = useState(module.tabs[0].id);

  const currentTab = module.tabs.find(t => t.id === activeTab) ?? module.tabs[0];
  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <SectionShell
      moduleId="commodities"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {TabComponent ? <TabComponent /> : <PlaceholderTab tab={currentTab} />}
    </SectionShell>
  );
}
