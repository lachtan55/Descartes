export interface TaxonomyEntry {
  category: string;
  value: string;
  label: string;
  color: string;
}

export const TAG_COLORS: Record<string, string> = {
  market:     '#00BCD4',
  instrument: '#5C9DFF',
  comdty:     '#FFB300',
  macro:      '#AB47BC',
  exchange:   '#78909C',
  currency:   '#26A69A',
  special:    '#FF7043',
  ticker:     '#00FF41',
  data_type:  '#90A4AE',
  timeframe:  '#B0BEC5',
};

export const CATEGORY_LABELS: Record<string, string> = {
  market:     'MARKET',
  instrument: 'INSTRUMENT',
  comdty:     'COMDTY',
  macro:      'MACRO',
  exchange:   'EXCHANGE',
  currency:   'CURRENCY',
  special:    'SPECIAL',
  ticker:     'TICKER',
  data_type:  'DATA TYPE',
  timeframe:  'TIMEFRAME',
};

export const FREE_FORM_CATEGORIES = new Set(['ticker', 'currency', 'macro']);

export const FIXED_VALUES: Record<string, string[]> = {
  market:     ['comdty_market', 'financial_market', 'stock_market', 'crypto_market', 'energy_market', 'realestate_market'],
  instrument: ['stock', 'ETF', 'index', 'futures', 'spot', 'options'],
  comdty:     ['comdty_rare-metals', 'comdty_colored-metals', 'comdty_energy', 'comdty_soft', 'comdty_grain', 'comdty_hardware', 'comdty_special'],
  exchange:   ['HL_EXCHANGE', 'IB_GETTEX', 'IB_NASDAQ', 'IB_NYSE', 'IB_XETR'],
  data_type:  ['price_data', 'thesis', 'research_report', 'macro_data', 'earnings', 'transcript', 'news', 'regulatory', 'technical_analysis', 'notes'],
  special:    ['war_geopolitics', 'short_squeeze', 'insider_buy', 'insider_sell', 'activist', 'm_and_a', 'earnings_beat', 'earnings_miss', 'bankruptcy', 'ipo', 'spinoff', 'supply_disruption'],
  timeframe:  ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'intraday'],
};

export const ALL_FILTER_CATEGORIES = Object.keys(FIXED_VALUES);

export function tagColor(category: string): string {
  return TAG_COLORS[category] ?? '#888';
}

export function tagLabel(category: string, value: string): string {
  return `${category}:${value}`;
}
