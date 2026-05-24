import { TradingSignal, PriceBar } from '../types';

/**
 * Returns the ISO date (YYYY-MM-DD) on which the signal expires.
 *
 * - If holdUntil is set → that date is the expiry
 * - Otherwise → the last date of the stored OHLCV dataset (last bar time)
 * - If neither is available → undefined (can't determine expiry)
 */
export function getExpiryDate(
  signal: TradingSignal,
  bars?: PriceBar[],
): string | undefined {
  if (signal.holdUntil) return signal.holdUntil;
  if (bars && bars.length > 0) return bars[bars.length - 1].time;
  return undefined;
}

/**
 * Returns true if the signal is past its expiry date as of `asOfDate`
 * (defaults to today). End-of-day semantics: a signal is expired when
 * today > expiryDate.
 */
export function isSignalExpired(
  signal: TradingSignal,
  bars?: PriceBar[],
  asOfDate?: string,
): boolean {
  const expiry = getExpiryDate(signal, bars);
  if (!expiry) return false;
  const check = asOfDate ?? new Date().toISOString().slice(0, 10);
  return check > expiry;
}
