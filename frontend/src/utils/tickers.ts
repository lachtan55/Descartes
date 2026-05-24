export const TICKER_MAP: Record<string, string> = {
  GC: 'GC=F',
  HG: 'HG=F',
  CL: 'CL=F',
  NG: 'NG=F',
  SI: 'SI=F',
  ZC: 'ZC=F',
  ZW: 'ZW=F',
  ZS: 'ZS=F',
  ES: 'ES=F',
  NQ: 'NQ=F',
  YM: 'YM=F',
  RTY: 'RTY=F',
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD',
  ADA: 'ADA-USD',
  XRP: 'XRP-USD',
};

export function normalizeTickerForYF(asset: string): string {
  return TICKER_MAP[asset.toUpperCase()] ?? asset;
}

export function formatPrice(price: number | undefined, asset?: string): string {
  if (price === undefined || price === null || isNaN(price)) return '—';
  if (!asset) return price.toFixed(2);
  const crypto = ['BTC', 'ETH', 'SOL'];
  const base = asset.replace('-USD', '').replace('=F', '');
  if (crypto.includes(base)) return price.toFixed(0);
  if (price > 1000) return price.toFixed(2);
  if (price > 10) return price.toFixed(2);
  return price.toFixed(4);
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return 'N/A';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function formatR(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return 'N/A';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + 'R';
}
