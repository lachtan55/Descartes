export interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  commands: string[];
  tabs: TabConfig[];
}

export interface TabConfig {
  id: string;
  label: string;
  component?: string;
  /** When true, renders a decorative non-interactive vertical divider in the tab bar. */
  separator?: boolean;
}

export const MODULES: ModuleConfig[] = [
  {
    id: 'live-trading',
    label: 'LIVE TRADING',
    description: 'Signal entry · Backtesting engine · Live tracking · Analytics',
    commands: ['LIVE TRADING', 'BACKTESTING', 'LT', 'BT', 'SIGNALS'],
    tabs: [
      { id: 'BACKTEST',   label: 'BACKTEST',    component: 'BacktestTab' },
      { id: 'SIGNALS',    label: 'SIGNALS',     component: 'SignalsTab' },
      { id: 'LIVE_TRACK', label: 'LIVE TRACK',  component: 'LiveTrackTab' },
      { id: 'LIVE_PRICE', label: 'LIVE PRICE',  component: 'LivePriceTab' },
      { id: 'TAB_SEP_1',  label: '',            separator: true },
      { id: 'ANALYTICS',  label: 'ANALYTICS',   component: 'AnalyticsTab' },
      { id: 'TAB_SEP_2',  label: '',            separator: true },
    ],
  },
  {
    id: 'commodities',
    label: 'COMDTY FUNDAMENTALS',
    description: 'Alpha · Markets & Geopolitics · Risk · Companies · Technicals',
    commands: ['COMDTY', 'COMMODITIES', 'CF'],
    tabs: [
      { id: 'ALPHA',       label: 'ALPHA' },
      { id: 'MARKETS',     label: 'MARKETS, GEO, GLOBAL TRADE RELATIONS' },
      { id: 'RISKS',       label: 'RISKS' },
      { id: 'C_COMPANIES', label: 'C. COMPANIES' },
      { id: 'TECHNICALS',  label: 'TWS/HL TECHNICALS' },
      // LIVE PRICE moved to Live Trading
    ],
  },
  {
    id: 'database',
    label: 'DATABASE',
    description: 'AI-tagged research document store · PDF/DOCX/CSV viewer · Gemini auto-tagging',
    commands: ['DATABASE', 'DB', 'DOCS'],
    tabs: [
      { id: 'DATABASE',  label: 'DATABASE',  component: 'PriceDataTab' },
      { id: 'DOCUMENTS', label: 'DOCUMENTS', component: 'DatabaseTab' },
    ],
  },
  {
    id: 'macroeconomics',
    label: 'MACROECONOMICS',
    description: 'Data registry · By-region dashboards · AI macro reports · Alpha indicators',
    commands: ['MACROECONOMICS', 'MACRO', 'MAINT', 'MAINTENANCE'],
    tabs: [
      { id: 'MAINTENANCE', label: 'MAINTENANCE' },
      { id: 'BY_REGION',   label: 'BY REGION' },
      { id: 'ALPHA',       label: 'ALPHA' },
    ],
  },
  // ─── ADD NEW MODULES HERE ───
];

// Auto-generated command → route map. Never edit manually.
export const COMMAND_MAP: Record<string, string> = Object.fromEntries(
  MODULES.flatMap(m => m.commands.map(cmd => [cmd, `/${m.id}`]))
);
COMMAND_MAP['HUB'] = '/';
COMMAND_MAP['HOME'] = '/';
