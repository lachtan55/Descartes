import { TradingSignal, ParseResult, AssetType, Direction, MomentumStrength, MomentumDirection } from '../types';
import { v4 as uuidv4 } from 'uuid';

const TICKER_PATTERN = /\b([A-Z]{1,5}(?:-[A-Z]{2,4})?(?:=F)?)\b/;
const FLOAT_PATTERN = /\d+(?:[.,]\d+)?/;

function inferAssetType(asset: string): AssetType {
  const futures = ['GC', 'CL', 'HG', 'SI', 'NG', 'ZC', 'ZW', 'ZS', 'ES', 'NQ', 'YM', 'RTY'];
  const crypto = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP'];
  const etfs = ['SPY', 'QQQ', 'GLD', 'SLV', 'COPX', 'XLE', 'XLF', 'ARKK', 'EEM', 'IWM'];

  const base = asset.replace('=F', '').replace('-USD', '').replace('-EUR', '');
  if (futures.includes(base) || asset.endsWith('=F')) return 'futures_commodity';
  if (['ES', 'NQ', 'YM', 'RTY'].includes(base)) return 'futures_index';
  if (crypto.includes(base) || asset.endsWith('-USD')) return 'crypto';
  if (etfs.includes(base)) return 'etf';
  return 'equity';
}

function extractFloat(text: string, afterKeywords: string[]): { value: number | null; index: number } {
  for (const kw of afterKeywords) {
    const re = new RegExp(`${kw}\\s*[=:]?\\s*(${FLOAT_PATTERN.source})`, 'i');
    const m = text.match(re);
    if (m) {
      return { value: parseFloat(m[1].replace(',', '.')), index: text.indexOf(m[0]) };
    }
  }
  return { value: null, index: -1 };
}

function extractDate(text: string): string | null {
  // ISO date — return YYYY-MM-DD only (no timezone conversion)
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  // DD.MM.YYYY
  const dmy = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return null;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function extractHoldUntil(text: string): string | null {
  // "hold until YYYY-MM-DD" or "hold until Sep 1" or "expiry: Sep 1, 2025"
  const lower = text.toLowerCase();

  // Explicit ISO after hold-until / expiry keywords
  const isoM = lower.match(/(?:hold\s*until|expir[esy:]+)\s*:?\s*(\d{4}-\d{2}-\d{2})/);
  if (isoM) return isoM[1];

  // "hold until Month DD [YYYY]" / "expiry: Month DD [YYYY]"
  const monM = lower.match(
    /(?:hold\s*until|expir[esy:]+)\s*:?\s*([a-z]{3})\s+(\d{1,2})(?:[,\s]+(\d{4}))?/,
  );
  if (monM) {
    const mo = MONTH_MAP[monM[1]];
    if (mo) {
      const year = monM[3] ?? new Date().getFullYear().toString();
      const day = monM[2].padStart(2, '0');
      return `${year}-${mo}-${day}`;
    }
  }

  return null;
}

export function parseSignal(raw: string): ParseResult {
  const text = raw.trim();
  const upper = text.toUpperCase();
  const flags: string[] = [];
  let confidence = 0;
  const signal: Partial<TradingSignal> = {
    raw_text: raw,
    parsed_by: 'rule_based',
  };

  // Direction
  if (/\bLONG\b/i.test(text)) {
    signal.direction = 'LONG';
    confidence += 0.2;
  } else if (/\bSHORT\b/i.test(text)) {
    signal.direction = 'SHORT';
    confidence += 0.2;
  } else {
    flags.push('direction_missing');
  }

  // Asset: word before or after direction keyword
  const dirMatch = text.match(/\b(LONG|SHORT)\s+([A-Z][A-Z0-9\-]{0,9})|([A-Z][A-Z0-9\-]{0,9})\s+(LONG|SHORT)/i);
  if (dirMatch) {
    const asset = (dirMatch[2] || dirMatch[3]).toUpperCase();
    signal.asset = asset;
    signal.asset_type = inferAssetType(asset);
    confidence += 0.2;
  } else {
    // fallback: first ticker-like token
    const tkm = upper.match(/\b([A-Z]{2,6}(?:-[A-Z]{2,4})?(?:=F)?)\b/);
    if (tkm && !['LONG', 'SHORT', 'STRONG', 'WEAK', 'ENTRY', 'TARGET', 'STOP', 'MOMENTUM', 'UP', 'DOWN'].includes(tkm[1])) {
      signal.asset = tkm[1];
      signal.asset_type = inferAssetType(tkm[1]);
      confidence += 0.1;
    } else {
      flags.push('asset_missing');
    }
  }

  // Entry price
  const entry = extractFloat(text, ['entry', '@']);
  if (entry.value !== null) {
    signal.entry_price = entry.value;
    confidence += 0.2;
  } else {
    // try first number after direction
    const numMatch = text.match(/(?:LONG|SHORT)\s+[A-Z\-=]+\s+([\d.,]+)/i);
    if (numMatch) {
      signal.entry_price = parseFloat(numMatch[1].replace(',', '.'));
      confidence += 0.1;
    } else {
      flags.push('entry_missing');
    }
  }

  // Take profit
  const target = extractFloat(text, ['target', 'tp', 't/p', 'take_profit']);
  if (target.value !== null) {
    signal.take_profit = target.value;
    confidence += 0.2;
  } else {
    flags.push('target_missing');
  }

  // Entry type default
  signal.entry_type = 'limit';

  // Stop loss
  const stop = extractFloat(text, ['sl', 'stop_loss', 'stop']);
  if (stop.value !== null) {
    signal.stop_loss = stop.value;
  }

  // Momentum strength
  if (/\bstrong\b/i.test(text)) {
    signal.momentum_strength = 'STRONG';
    confidence += 0.1;
  } else if (/\bweak\b/i.test(text)) {
    signal.momentum_strength = 'WEAK';
    confidence += 0.1;
  } else {
    flags.push('momentum_strength_missing');
    signal.momentum_strength = 'STRONG';
  }

  // Momentum direction
  if (/\bup\b/i.test(text)) {
    signal.momentum_direction = 'UP';
    confidence += 0.1;
  } else if (/\bdown\b/i.test(text)) {
    signal.momentum_direction = 'DOWN';
    confidence += 0.1;
  } else {
    flags.push('momentum_direction_missing');
    signal.momentum_direction = 'UP';
  }

  // Hold Until
  const holdUntilStr = extractHoldUntil(text);
  if (holdUntilStr) signal.holdUntil = holdUntilStr;

  // Timestamp — store as YYYY-MM-DD (skip hold-until date if it was consumed)
  const dateStr = extractDate(text);
  signal.created_at = dateStr ?? new Date().toISOString().slice(0, 10);

  // Notes: remove all matched structured content, remainder is notes
  let remainder = text
    .replace(/\b(LONG|SHORT)\b/gi, '')
    .replace(/entry\s*[=:]\s*[\d.,]+/gi, '')
    .replace(/target\s*[=:]\s*[\d.,]+/gi, '')
    .replace(/tp\s*[=:]\s*[\d.,]+/gi, '')
    .replace(/sl\s*[=:]\s*[\d.,]+/gi, '')
    .replace(/stop(?:_loss)?\s*[=:]\s*[\d.,]+/gi, '')
    .replace(/momentum\s*[=:]\s*\w+\s*\w+/gi, '')
    .replace(/\b(strong|weak|up|down)\b/gi, '')
    .replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/g, '')
    .replace(/\|/g, '')
    .replace(new RegExp(`\\b${signal.asset ?? 'XXXXXX'}\\b`, 'i'), '')
    .trim()
    .replace(/\s+/g, ' ')
    .trim();

  if (remainder) signal.notes = remainder;

  signal.status = 'pending';
  signal.id = uuidv4();

  return { signal, confidence: Math.min(confidence, 1), flags };
}

export function buildFullSignal(partial: Partial<TradingSignal>): TradingSignal {
  return {
    id: partial.id ?? uuidv4(),
    created_at: partial.created_at ?? new Date().toISOString().slice(0, 10),
    asset: partial.asset ?? '',
    asset_type: partial.asset_type ?? 'equity',
    direction: partial.direction ?? 'LONG',
    entry_type: partial.entry_type ?? 'limit',
    entry_price: partial.entry_price ?? 0,
    actual_entry_price: partial.actual_entry_price,
    momentum_strength: partial.momentum_strength ?? 'STRONG',
    momentum_direction: partial.momentum_direction ?? 'UP',
    take_profit: partial.take_profit ?? 0,
    holdUntil: partial.holdUntil || undefined,
    notes: partial.notes,
    raw_text: partial.raw_text,
    parsed_by: partial.parsed_by ?? 'manual',
    status: partial.status ?? 'pending',
    close_price: partial.close_price,
    close_date: partial.close_date,
    pnl_pct: partial.pnl_pct,
    r_multiple: partial.r_multiple,
    stop_loss: partial.stop_loss,
  };
}
