import { Routes, Route, Navigate } from 'react-router-dom';
import { HealthProvider } from './context/HealthContext';
import HubPage from './pages/HubPage';
import BacktestingSection from './pages/BacktestingSection';
import CommoditiesSection from './pages/CommoditiesSection';
import DatabaseSection from './pages/DatabaseSection';
import MacroeconomicsSection from './pages/MacroeconomicsSection';

export default function App() {
  return (
    <HealthProvider>
    <Routes>
      <Route path="/" element={<HubPage />} />
      <Route path="/live-trading" element={<BacktestingSection />} />
      {/* Legacy alias so old bookmarks continue to work */}
      <Route path="/backtesting" element={<Navigate to="/live-trading" replace />} />
      <Route path="/commodities" element={<CommoditiesSection />} />
      <Route path="/database" element={<DatabaseSection />} />
      <Route path="/macroeconomics" element={<MacroeconomicsSection />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      {/* ─── ADD NEW ROUTES HERE when adding modules ─── */}
    </Routes>
    </HealthProvider>
  );
}
