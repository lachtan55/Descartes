export interface AlphaIndicatorConfig {
  id: string;
  label: string;
  description: string;  // what it will show when built
  indexSection: 'sp500' | 'dax' | 'nikkei' | 'china' | 'world';
}

export const ALPHA_INDEX_SECTIONS = [
  { id: 'sp500',  label: 'S&P 500',  region: 'US' },
  { id: 'dax',    label: 'DAX',      region: 'Germany' },
  { id: 'nikkei', label: 'NIKKEI',   region: 'Japan' },
  { id: 'china',  label: 'CHINA',    region: 'China' },
  { id: 'world',  label: 'WORLD',    region: 'World' },
] as const;

export const ALPHA_INDICATORS: AlphaIndicatorConfig[] = [
  // S&P 500
  { id: 'sp500_macro_attitude', label: 'Macro Attitude Score', description: 'Composite macro sentiment score for US equities (GDP, CPI, rates, PMI)', indexSection: 'sp500' },
  { id: 'sp500_rates_headwind', label: 'Rates Headwind Index', description: 'Relative impact of Fed policy path on equity valuations', indexSection: 'sp500' },
  { id: 'sp500_earnings_revision', label: 'Earnings Revision', description: 'Aggregate sell-side earnings revision momentum', indexSection: 'sp500' },
  { id: 'sp500_credit_conditions', label: 'Credit Conditions', description: 'Investment grade/HY spread overlay as risk proxy', indexSection: 'sp500' },

  // DAX
  { id: 'dax_macro_attitude', label: 'Macro Attitude Score', description: 'Composite macro sentiment score for German equities', indexSection: 'dax' },
  { id: 'dax_export_exposure', label: 'Export Exposure Index', description: 'German export demand driven by global PMI and FX', indexSection: 'dax' },
  { id: 'dax_energy_risk', label: 'Energy Risk Score', description: 'German industrial sensitivity to energy price volatility', indexSection: 'dax' },
  { id: 'dax_ecb_path', label: 'ECB Path Index', description: 'ECB rate expectations impact on DAX earnings multiples', indexSection: 'dax' },

  // NIKKEI
  { id: 'nikkei_macro_attitude', label: 'Macro Attitude Score', description: 'Composite macro sentiment for Japan equities', indexSection: 'nikkei' },
  { id: 'nikkei_yen_impact', label: 'Yen/Export Impact', description: 'USD/JPY sensitivity for Nikkei export earnings', indexSection: 'nikkei' },
  { id: 'nikkei_boj_policy', label: 'BOJ Policy Index', description: 'BOJ normalisation pace effect on equity multiples', indexSection: 'nikkei' },
  { id: 'nikkei_global_cycle', label: 'Global Cycle Beta', description: 'Nikkei sensitivity to global manufacturing cycle', indexSection: 'nikkei' },

  // China
  { id: 'china_macro_attitude', label: 'Macro Attitude Score', description: 'Composite macro sentiment for China equities (NBS data)', indexSection: 'china' },
  { id: 'china_property_risk', label: 'Property Risk Score', description: 'Chinese property sector debt stress indicator', indexSection: 'china' },
  { id: 'china_stimulus_pulse', label: 'Stimulus Pulse', description: 'PBOC/fiscal stimulus impulse and credit growth', indexSection: 'china' },
  { id: 'china_geopolitical', label: 'Geopolitical Risk', description: 'Trade policy and geopolitical tension overlay', indexSection: 'china' },

  // World
  { id: 'world_macro_attitude', label: 'Global Macro Score', description: 'Cross-regional composite macro attitude', indexSection: 'world' },
  { id: 'world_growth_dispersion', label: 'Growth Dispersion', description: 'Cross-country GDP growth divergence metric', indexSection: 'world' },
  { id: 'world_inflation_convergence', label: 'Inflation Convergence', description: 'G6 inflation convergence to target measure', indexSection: 'world' },
  { id: 'world_dxy_impact', label: 'DXY / FX Impact', description: 'USD strength impact on EM and global earnings', indexSection: 'world' },
];
