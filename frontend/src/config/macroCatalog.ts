export interface MacroSeries {
  id: string;
  label: string;
  region: 'US' | 'China' | 'Eurozone' | 'Germany' | 'Japan' | 'Czechia';
  category: 'gdp' | 'inflation' | 'rates' | 'forecasts' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'meeting_based';
  source: string;
  bridgeStatus: 'connected' | 'stale' | 'manual' | 'not_built';
  endpoint?: string;
  apiSeriesCode?: string;
  unit: string;
  currency?: string;
  coverageStart: number;
  lastUpdated?: string;
  active: boolean;
  dataQuality: 'official' | 'estimated' | 'revised' | 'preliminary' | 'disputed' | 'modeled';
  notes?: string;
  isCore: boolean;
  chinaDisclaimer?: boolean;
}

export const MACRO_DATA_CATALOG: MacroSeries[] = [
  // ────────────────────────────────────────────────
  // UNITED STATES — source: fred_api
  // ────────────────────────────────────────────────
  {
    id: 'us_gdp_nominal_q',
    label: 'US GDP Nominal (Quarterly)',
    region: 'US', category: 'gdp', frequency: 'quarterly',
    source: 'fred_api', bridgeStatus: 'not_built',
    endpoint: 'https://api.stlouisfed.org/fred/series/observations',
    apiSeriesCode: 'GDP',
    unit: 'Billions USD SAAR', currency: 'USD',
    coverageStart: 1947, active: true, dataQuality: 'official', isCore: true,
    notes: 'Gross Domestic Product, seasonally adjusted annual rate',
  },
  {
    id: 'us_gdp_nominal_a',
    label: 'US GDP Nominal (Annual)',
    region: 'US', category: 'gdp', frequency: 'annual',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'GDPA',
    unit: 'Billions USD', currency: 'USD',
    coverageStart: 1929, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'us_gdp_growth_q',
    label: 'US GDP Growth QoQ (Real)',
    region: 'US', category: 'gdp', frequency: 'quarterly',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'A191RL1Q225SBEA',
    unit: '% Change SAAR', currency: 'USD',
    coverageStart: 1947, active: true, dataQuality: 'official', isCore: true,
    notes: 'Real GDP % change, SAAR',
  },
  {
    id: 'us_gdp_growth_a',
    label: 'US GDP Growth YoY (Annual)',
    region: 'US', category: 'gdp', frequency: 'annual',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'A191RL1A225NBEA',
    unit: '% Change', currency: 'USD',
    coverageStart: 1930, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'us_cpi_monthly',
    label: 'US CPI All Items (Monthly)',
    region: 'US', category: 'inflation', frequency: 'monthly',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'CPIAUCSL',
    unit: 'Index 1982-84=100', currency: 'USD',
    coverageStart: 1947, active: true, dataQuality: 'official', isCore: true,
    notes: 'Consumer Price Index for All Urban Consumers',
  },
  {
    id: 'us_core_cpi_monthly',
    label: 'US Core CPI (ex Food & Energy)',
    region: 'US', category: 'inflation', frequency: 'monthly',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'CPILFESL',
    unit: 'Index 1982-84=100', currency: 'USD',
    coverageStart: 1957, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'us_ppi_monthly',
    label: 'US PPI Final Demand (Monthly)',
    region: 'US', category: 'inflation', frequency: 'monthly',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'PPIACO',
    unit: 'Index 1982=100', currency: 'USD',
    coverageStart: 1913, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'us_fed_funds_rate',
    label: 'US Federal Funds Rate',
    region: 'US', category: 'rates', frequency: 'monthly',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'FEDFUNDS',
    unit: '%', currency: 'USD',
    coverageStart: 1954, active: true, dataQuality: 'official', isCore: true,
    notes: 'Effective Federal Funds Rate, monthly average',
  },
  {
    id: 'us_yield_2y',
    label: 'US Treasury 2Y Yield',
    region: 'US', category: 'rates', frequency: 'daily',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'DGS2',
    unit: '%', currency: 'USD',
    coverageStart: 1976, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'us_yield_10y',
    label: 'US Treasury 10Y Yield',
    region: 'US', category: 'rates', frequency: 'daily',
    source: 'fred_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'DGS10',
    unit: '%', currency: 'USD',
    coverageStart: 1962, active: true, dataQuality: 'official', isCore: true,
  },

  // ────────────────────────────────────────────────
  // CHINA — source: manual_upload, NBS data
  // ────────────────────────────────────────────────
  {
    id: 'cn_gdp_nominal_a',
    label: 'China GDP Nominal (Annual)',
    region: 'China', category: 'gdp', frequency: 'annual',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: 'Trillion CNY', currency: 'CNY',
    coverageStart: 1978, active: true, dataQuality: 'official',
    isCore: true, chinaDisclaimer: true,
    notes: 'NBS official nominal GDP in CNY trillion',
  },
  {
    id: 'cn_gdp_growth_q',
    label: 'China GDP Growth YoY (Quarterly)',
    region: 'China', category: 'gdp', frequency: 'quarterly',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '% YoY', currency: 'CNY',
    coverageStart: 1992, active: true, dataQuality: 'official',
    isCore: true, chinaDisclaimer: true,
    notes: 'NBS GDP growth year-on-year. Data quality: official NBS.',
  },
  {
    id: 'cn_cpi_monthly',
    label: 'China CPI (Monthly YoY %)',
    region: 'China', category: 'inflation', frequency: 'monthly',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '% YoY',
    coverageStart: 1985, active: true, dataQuality: 'official',
    isCore: true, chinaDisclaimer: true,
  },
  {
    id: 'cn_pboc_lpr_1y',
    label: 'China PBOC Loan Prime Rate (1Y)',
    region: 'China', category: 'rates', frequency: 'meeting_based',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '%',
    coverageStart: 2019, active: true, dataQuality: 'official',
    isCore: true, chinaDisclaimer: true,
    notes: '1-Year Loan Prime Rate, set by PBOC. 5Y LPR also available.',
  },

  // ────────────────────────────────────────────────
  // EUROZONE — source: ecb_api
  // ────────────────────────────────────────────────
  {
    id: 'eu_gdp_growth_q',
    label: 'Eurozone GDP Growth (Quarterly)',
    region: 'Eurozone', category: 'gdp', frequency: 'quarterly',
    source: 'ecb_api', bridgeStatus: 'not_built',
    unit: '% QoQ', currency: 'EUR',
    coverageStart: 1995, active: true, dataQuality: 'official', isCore: true,
    notes: 'Eurostat via ECB SDW',
  },
  {
    id: 'eu_hicp_monthly',
    label: 'Eurozone HICP Inflation (Monthly)',
    region: 'Eurozone', category: 'inflation', frequency: 'monthly',
    source: 'ecb_api', bridgeStatus: 'not_built',
    endpoint: 'https://data-api.ecb.europa.eu/service/data',
    apiSeriesCode: 'ICP.M.U2.N.000000.4.INX',
    unit: 'Index 2015=100', currency: 'EUR',
    coverageStart: 1996, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'eu_ecb_deposit_rate',
    label: 'ECB Deposit Facility Rate',
    region: 'Eurozone', category: 'rates', frequency: 'meeting_based',
    source: 'ecb_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'FM.B.U2.EUR.4F.KR.DFR.LEV',
    unit: '%', currency: 'EUR',
    coverageStart: 1999, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'eu_yield_10y_bund',
    label: 'Germany 10Y Bund Yield (Proxy)',
    region: 'Eurozone', category: 'rates', frequency: 'daily',
    source: 'ecb_api', bridgeStatus: 'not_built',
    unit: '%', currency: 'EUR',
    coverageStart: 1993, active: true, dataQuality: 'official', isCore: false,
    notes: 'German Bund 10Y used as Eurozone benchmark',
  },

  // ────────────────────────────────────────────────
  // GERMANY — source: ecb_api + worldbank_api
  // ────────────────────────────────────────────────
  {
    id: 'de_gdp_nominal_a',
    label: 'Germany GDP Nominal (Annual)',
    region: 'Germany', category: 'gdp', frequency: 'annual',
    source: 'worldbank_api', bridgeStatus: 'not_built',
    unit: 'Billion EUR', currency: 'EUR',
    coverageStart: 1991, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'de_gdp_growth_q',
    label: 'Germany GDP Growth (Quarterly)',
    region: 'Germany', category: 'gdp', frequency: 'quarterly',
    source: 'ecb_api', bridgeStatus: 'not_built',
    unit: '% QoQ', currency: 'EUR',
    coverageStart: 1991, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'de_hicp_monthly',
    label: 'Germany HICP Inflation (Monthly)',
    region: 'Germany', category: 'inflation', frequency: 'monthly',
    source: 'ecb_api', bridgeStatus: 'not_built',
    apiSeriesCode: 'ICP.M.DE.N.000000.4.INX',
    unit: 'Index 2015=100', currency: 'EUR',
    coverageStart: 1996, active: true, dataQuality: 'official', isCore: true,
  },

  // ────────────────────────────────────────────────
  // JAPAN — source: manual_upload initially
  // ────────────────────────────────────────────────
  {
    id: 'jp_gdp_nominal_a',
    label: 'Japan GDP Nominal (Annual)',
    region: 'Japan', category: 'gdp', frequency: 'annual',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: 'Trillion JPY', currency: 'JPY',
    coverageStart: 1994, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'jp_gdp_growth_q',
    label: 'Japan GDP Growth (Quarterly)',
    region: 'Japan', category: 'gdp', frequency: 'quarterly',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '% QoQ', currency: 'JPY',
    coverageStart: 1994, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'jp_cpi_monthly',
    label: 'Japan CPI (Monthly YoY %)',
    region: 'Japan', category: 'inflation', frequency: 'monthly',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '% YoY',
    coverageStart: 1970, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'jp_boj_policy_rate',
    label: 'Japan BOJ Policy Rate',
    region: 'Japan', category: 'rates', frequency: 'meeting_based',
    source: 'manual_upload', bridgeStatus: 'not_built',
    unit: '%',
    coverageStart: 1998, active: true, dataQuality: 'official', isCore: true,
    notes: 'BOJ target for overnight call rate. As of mid-2024: 0.10%',
  },

  // ────────────────────────────────────────────────
  // CZECHIA — source: czso_api + cnb_api
  // ────────────────────────────────────────────────
  {
    id: 'cz_gdp_nominal_a',
    label: 'Czechia GDP Nominal (Annual)',
    region: 'Czechia', category: 'gdp', frequency: 'annual',
    source: 'czso_api', bridgeStatus: 'not_built',
    unit: 'Billion CZK', currency: 'CZK',
    coverageStart: 1995, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'cz_gdp_growth_q',
    label: 'Czechia GDP Growth (Quarterly)',
    region: 'Czechia', category: 'gdp', frequency: 'quarterly',
    source: 'czso_api', bridgeStatus: 'not_built',
    unit: '% QoQ', currency: 'CZK',
    coverageStart: 1996, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'cz_cpi_monthly',
    label: 'Czechia CPI (Monthly YoY %)',
    region: 'Czechia', category: 'inflation', frequency: 'monthly',
    source: 'czso_api', bridgeStatus: 'not_built',
    unit: '% YoY',
    coverageStart: 1993, active: true, dataQuality: 'official', isCore: true,
  },
  {
    id: 'cz_cnb_repo_rate',
    label: 'Czechia CNB 2W Repo Rate',
    region: 'Czechia', category: 'rates', frequency: 'meeting_based',
    source: 'cnb_api', bridgeStatus: 'not_built',
    endpoint: 'https://www.cnb.cz/cnb/STAT.ARADY_PKG.VYSTUP_DATA',
    unit: '%',
    coverageStart: 1993, active: true, dataQuality: 'official', isCore: true,
    notes: 'CNB 2-week repo rate. Peaked at 7% in mid-2022.',
  },

  // ────────────────────────────────────────────────
  // IMF WEO FORECAST SERIES
  // ────────────────────────────────────────────────
  {
    id: 'imf_weo_us_gdp_growth',
    label: 'IMF WEO — US GDP Growth Forecast',
    region: 'US', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY',
    coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO code: NGDP_RPCH. WEO country: 111 (US)',
  },
  {
    id: 'imf_weo_us_cpi',
    label: 'IMF WEO — US CPI Forecast',
    region: 'US', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO code: PCPIPCH',
  },
  {
    id: 'imf_weo_us_govdebt',
    label: 'IMF WEO — US Public Debt % GDP',
    region: 'US', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% GDP', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: false,
    notes: 'WEO code: GGXWDG_NGDP',
  },
  {
    id: 'imf_weo_cn_gdp_growth',
    label: 'IMF WEO — China GDP Growth Forecast',
    region: 'China', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY', coverageStart: 2020, active: true, dataQuality: 'modeled',
    isCore: true, chinaDisclaimer: true,
  },
  {
    id: 'imf_weo_cn_cpi',
    label: 'IMF WEO — China CPI Forecast',
    region: 'China', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled',
    isCore: true, chinaDisclaimer: true,
  },
  {
    id: 'imf_weo_eu_gdp_growth',
    label: 'IMF WEO — Eurozone GDP Growth',
    region: 'Eurozone', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO country: 935 (Euro area)',
  },
  {
    id: 'imf_weo_eu_cpi',
    label: 'IMF WEO — Eurozone CPI Forecast',
    region: 'Eurozone', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
  },
  {
    id: 'imf_weo_de_gdp_growth',
    label: 'IMF WEO — Germany GDP Growth',
    region: 'Germany', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO country: 163',
  },
  {
    id: 'imf_weo_de_cpi',
    label: 'IMF WEO — Germany CPI Forecast',
    region: 'Germany', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
  },
  {
    id: 'imf_weo_jp_gdp_growth',
    label: 'IMF WEO — Japan GDP Growth',
    region: 'Japan', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO country: 158',
  },
  {
    id: 'imf_weo_jp_cpi',
    label: 'IMF WEO — Japan CPI Forecast',
    region: 'Japan', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
  },
  {
    id: 'imf_weo_cz_gdp_growth',
    label: 'IMF WEO — Czechia GDP Growth',
    region: 'Czechia', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% Real YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
    notes: 'WEO country: 174 (Czech Republic)',
  },
  {
    id: 'imf_weo_cz_cpi',
    label: 'IMF WEO — Czechia CPI Forecast',
    region: 'Czechia', category: 'forecasts', frequency: 'annual',
    source: 'imf_weo_csv', bridgeStatus: 'not_built',
    unit: '% YoY', coverageStart: 2020, active: true, dataQuality: 'modeled', isCore: true,
  },
];

export const CATALOG_BY_ID: Record<string, MacroSeries> = Object.fromEntries(
  MACRO_DATA_CATALOG.map(s => [s.id, s])
);

export const CATALOG_BY_REGION: Record<string, MacroSeries[]> = MACRO_DATA_CATALOG.reduce<
  Record<string, MacroSeries[]>
>((acc, s) => {
  (acc[s.region] ??= []).push(s);
  return acc;
}, {});
