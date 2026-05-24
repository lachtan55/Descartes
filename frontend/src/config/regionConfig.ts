export interface RegionConfig {
  id: string;         // "US" | "China" | "Eurozone" | "Germany" | "Japan" | "Czechia"
  label: string;
  isoCode: string;    // ISO 3166-1 alpha-2
  flag: string;       // emoji flag
  currency: string;   // "USD" | "CNY" | "EUR" | "JPY" | "CZK"
  centralBank: string;
  cbTarget?: string;  // inflation target description
  hasChDisclaimer: boolean;
}

export const REGIONS: RegionConfig[] = [
  {
    id: 'US',
    label: 'United States',
    isoCode: 'US',
    flag: '🇺🇸',
    currency: 'USD',
    centralBank: 'Federal Reserve',
    cbTarget: '2% symmetric',
    hasChDisclaimer: false,
  },
  {
    id: 'China',
    label: 'China',
    isoCode: 'CN',
    flag: '🇨🇳',
    currency: 'CNY',
    centralBank: 'PBOC',
    cbTarget: 'Indicative ~3%',
    hasChDisclaimer: true,
  },
  {
    id: 'Eurozone',
    label: 'Eurozone',
    isoCode: 'EU',
    flag: '🇪🇺',
    currency: 'EUR',
    centralBank: 'ECB',
    cbTarget: '2% symmetric (HICP)',
    hasChDisclaimer: false,
  },
  {
    id: 'Germany',
    label: 'Germany',
    isoCode: 'DE',
    flag: '🇩🇪',
    currency: 'EUR',
    centralBank: 'Bundesbank / ECB',
    cbTarget: '2% symmetric (ECB)',
    hasChDisclaimer: false,
  },
  {
    id: 'Japan',
    label: 'Japan',
    isoCode: 'JP',
    flag: '🇯🇵',
    currency: 'JPY',
    centralBank: 'Bank of Japan',
    cbTarget: '2% flexible',
    hasChDisclaimer: false,
  },
  {
    id: 'Czechia',
    label: 'Czechia',
    isoCode: 'CZ',
    flag: '🇨🇿',
    currency: 'CZK',
    centralBank: 'CNB',
    cbTarget: '2% ± 1pp band',
    hasChDisclaimer: false,
  },
];

export const REGION_MAP: Record<string, RegionConfig> = Object.fromEntries(
  REGIONS.map(r => [r.id, r])
);
