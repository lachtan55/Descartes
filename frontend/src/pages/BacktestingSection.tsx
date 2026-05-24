import { useState, useEffect, ReactNode } from 'react';
import SectionShell from '../components/SectionShell';
import SignalsTab from './SignalsTab';
import BacktestTab from './BacktestTab';
import LiveTrackTab from './LiveTrackTab';
import AnalyticsTab from './AnalyticsTab';
import LivePriceTab from '../components/LivePriceTab';
import { TradingSignal } from '../types';
import { loadSignals, saveSignals } from '../utils/storage';

type TabProps = { signals: TradingSignal[]; onSignalsChange: (s: TradingSignal[]) => void };
type TabRenderer = (props: TabProps) => ReactNode;

const TAB_RENDERERS: Record<string, TabRenderer> = {
  BACKTEST:   ({ signals, onSignalsChange }) => <BacktestTab signals={signals} onSignalsChange={onSignalsChange} />,
  SIGNALS:    ({ signals, onSignalsChange }) => <SignalsTab signals={signals} onSignalsChange={onSignalsChange} />,
  LIVE_TRACK: ({ signals, onSignalsChange }) => <LiveTrackTab signals={signals} onSignalsChange={onSignalsChange} />,
  LIVE_PRICE: () => <LivePriceTab />,
  ANALYTICS:  ({ signals }) => <AnalyticsTab signals={signals} />,
  // ─── ADD NEW TAB RENDERERS HERE ───
};

export default function BacktestingSection() {
  const [activeTab, setActiveTab] = useState('BACKTEST');
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    setSignals(loadSignals());
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const updateSignals = (updated: TradingSignal[]) => {
    setSignals(updated);
    saveSignals(updated);
  };

  const offlineBanner = backendOnline === false ? (
    <div className="status-banner offline-banner">
      BACKEND OFFLINE — yfinance and AI features unavailable. Start the FastAPI server at localhost:8001.
    </div>
  ) : null;

  const tabProps: TabProps = { signals, onSignalsChange: updateSignals };

  return (
    <SectionShell
      moduleId="live-trading"
      activeTab={activeTab}
      onTabChange={setActiveTab}
      aboveContent={offlineBanner}
    >
      {TAB_RENDERERS[activeTab]?.(tabProps)}
    </SectionShell>
  );
}
