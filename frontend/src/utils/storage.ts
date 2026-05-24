import { TradingSignal, StoredPriceData, PriceBar } from '../types';

const SIGNALS_KEY = 'signals_v1';
const PRICE_DATA_PREFIX = 'price_data_';

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert('localStorage quota exceeded. Please delete some stored price datasets from the DATA tab.');
    }
    throw e;
  }
}

export function loadSignals(): TradingSignal[] {
  const raw = safeGet<any[]>(SIGNALS_KEY, []);
  // Migrate signals that used the old field names from before the rename
  return raw.map(s => {
    if (s.target_price !== undefined && s.take_profit === undefined) {
      s.take_profit = s.target_price;
      delete s.target_price;
    }
    if (!s.entry_type) s.entry_type = 'limit';
    if (s.created_at && s.created_at.length > 10) {
      s.created_at = s.created_at.slice(0, 10);
    }
    // Nulls stored by JSON survive round-trips; convert to undefined so guards work
    if (s.pnl_pct === null) delete s.pnl_pct;
    if (s.r_multiple === null) delete s.r_multiple;
    if (s.close_price === null) delete s.close_price;
    if (s.close_date === null) delete s.close_date;
    if (s.actual_entry_price === null) delete s.actual_entry_price;
    if (s.stop_loss === null) delete s.stop_loss;
    if (s.holdUntil === null) delete s.holdUntil;
    return s as TradingSignal;
  });
}

export function saveSignals(signals: TradingSignal[]): void {
  safeSet(SIGNALS_KEY, signals);
}

export function addSignal(signal: TradingSignal): TradingSignal[] {
  const signals = loadSignals();
  const updated = [...signals, signal];
  saveSignals(updated);
  return updated;
}

export function updateSignal(id: string, patch: Partial<TradingSignal>): TradingSignal[] {
  const signals = loadSignals();
  const updated = signals.map(s => s.id === id ? { ...s, ...patch } : s);
  saveSignals(updated);
  return updated;
}

export function deleteSignal(id: string): TradingSignal[] {
  const signals = loadSignals();
  const updated = signals.filter(s => s.id !== id);
  saveSignals(updated);
  return updated;
}

export function loadPriceData(ticker: string): StoredPriceData | null {
  return safeGet<StoredPriceData | null>(`${PRICE_DATA_PREFIX}${ticker}`, null);
}

/**
 * Save price data for a ticker, merging with any previously stored bars.
 * Bars are deduplicated by `time` (new data wins on conflict) and sorted
 * ascending. Returns the final merged bar count.
 */
export function savePriceData(data: StoredPriceData): number {
  const existing = loadPriceData(data.ticker);
  let bars: PriceBar[];

  if (existing && existing.bars.length > 0) {
    // Merge: build a map keyed by date string; newer fetch overwrites dupes
    const map = new Map<string, PriceBar>();
    for (const b of existing.bars) map.set(b.time, b);
    for (const b of data.bars)    map.set(b.time, b);
    bars = Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
  } else {
    bars = [...data.bars].sort((a, b) => a.time.localeCompare(b.time));
  }

  safeSet(`${PRICE_DATA_PREFIX}${data.ticker}`, { ...data, bars });
  return bars.length;
}

export function deletePriceData(ticker: string): void {
  localStorage.removeItem(`${PRICE_DATA_PREFIX}${ticker}`);
}

export function listStoredPriceDatasets(): StoredPriceData[] {
  const result: StoredPriceData[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PRICE_DATA_PREFIX)) {
      const data = safeGet<StoredPriceData | null>(key, null);
      if (data) result.push(data);
    }
  }
  return result;
}
