/**
 * Timeframe filtering utilities for macro charts.
 * Used by GDPSection, CPISection, InterestRatesSection.
 */

export const TIMEFRAMES = ['YTD', '1Y', '5Y', '10Y', '15Y', '20Y'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export const DEFAULT_TIMEFRAME: Timeframe = '10Y';

/** Returns the cutoff Date for a given timeframe label (relative to today). */
export function getTimeframeCutoff(tf: Timeframe): Date {
  const now = new Date();
  switch (tf) {
    case 'YTD':  return new Date(now.getFullYear(), 0, 1);
    case '1Y':   return new Date(now.getFullYear() - 1,  now.getMonth(), now.getDate());
    case '5Y':   return new Date(now.getFullYear() - 5,  now.getMonth(), now.getDate());
    case '10Y':  return new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    case '15Y':  return new Date(now.getFullYear() - 15, now.getMonth(), now.getDate());
    case '20Y':  return new Date(now.getFullYear() - 20, now.getMonth(), now.getDate());
  }
}

/** Filters an array of objects that have a `date: string` (ISO) field.
 *  Falls back to the full array if the filtered result has fewer than 2 points
 *  (i.e. the series doesn't reach back that far — avoids blank charts). */
export function filterByTimeframe<T extends { date: string }>(
  data: T[],
  tf: Timeframe,
): T[] {
  if (!data.length) return data;
  const cutoff = getTimeframeCutoff(tf);
  const filtered = data.filter(p => new Date(p.date) >= cutoff);
  return filtered.length >= 2 ? filtered : data;
}
