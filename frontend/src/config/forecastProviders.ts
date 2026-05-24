export interface ForecastProvider {
  id: string;       // "imf" | "world_bank" | "oecd" | etc.
  label: string;    // "IMF" | "World Bank" | "OECD"
  fullLabel: string; // for vintage: "IMF Apr 2025 WEO"
  color: string;    // unique color per provider for table row identification
}

export const FORECAST_PROVIDERS: ForecastProvider[] = [
  { id: 'imf',            label: 'IMF',         fullLabel: 'IMF WEO 2025',        color: '#4285F4' },
  { id: 'world_bank',     label: 'World Bank',  fullLabel: 'World Bank 2025',     color: '#34A853' },
  { id: 'oecd',           label: 'OECD',        fullLabel: 'OECD Economic Outlook', color: '#FBBC05' },
  { id: 'fed',            label: 'Fed',         fullLabel: 'Fed SEP 2025',        color: '#1565C0' },
  { id: 'ecb',            label: 'ECB',         fullLabel: 'ECB Staff Proj. 2025',color: '#003087' },
  { id: 'bundesbank',     label: 'Bundesbank',  fullLabel: 'Bundesbank Proj. 2025', color: '#CC0000' },
  { id: 'boj',            label: 'BOJ',         fullLabel: 'BOJ Outlook 2025',    color: '#CC0000' },
  { id: 'pboc',           label: 'PBOC',        fullLabel: 'PBOC 2025',           color: '#CC0000' },
  { id: 'cnb',            label: 'CNB',         fullLabel: 'CNB Inflation Report 2025', color: '#0057A5' },
  { id: 'goldman_sachs',  label: 'Goldman',     fullLabel: 'Goldman Sachs 2025',  color: '#5C9DFF' },
  { id: 'jpmorgan',       label: 'JPMorgan',    fullLabel: 'JPMorgan 2025',       color: '#006DA7' },
  { id: 'morgan_stanley', label: 'MS',          fullLabel: 'Morgan Stanley 2025', color: '#27509B' },
  { id: 'barclays',       label: 'Barclays',    fullLabel: 'Barclays 2025',       color: '#00AEEF' },
  { id: 'ubs',            label: 'UBS',         fullLabel: 'UBS 2025',            color: '#E60028' },
  { id: 'citi',           label: 'Citi',        fullLabel: 'Citi 2025',           color: '#003087' },
  { id: 'deutsche_bank',  label: 'Deutsche',    fullLabel: 'Deutsche Bank 2025',  color: '#0019A1' },
  { id: 'bloomberg_consensus', label: 'BBG',    fullLabel: 'Bloomberg Consensus', color: '#F0A500' },
];

export const PROVIDER_MAP: Record<string, ForecastProvider> = Object.fromEntries(
  FORECAST_PROVIDERS.map(p => [p.id, p])
);

/** Default locked providers per region */
export const LOCKED_PROVIDERS_BY_REGION: Record<string, string[]> = {
  US:       ['imf', 'world_bank', 'oecd', 'fed'],
  China:    ['imf', 'world_bank', 'pboc'],
  Eurozone: ['imf', 'world_bank', 'oecd', 'ecb'],
  Germany:  ['imf', 'world_bank', 'oecd', 'ecb', 'bundesbank'],
  Japan:    ['imf', 'world_bank', 'oecd', 'boj'],
  Czechia:  ['imf', 'world_bank', 'oecd', 'cnb'],
};
