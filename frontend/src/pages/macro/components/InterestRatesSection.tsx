import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import BloombergChartWrapper from './BloombergChartWrapper';
import OutlookTable from './OutlookTable';
import type { RatesData, OutlookTable as OutlookTableData } from '../types';
import { DEFAULT_TIMEFRAME, filterByTimeframe, type Timeframe } from '../utils/timeframe';

interface Props {
  region: string;
}

const API = 'http://localhost:8000';

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number | string;
  color: string;
}
interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function BbgTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #333',
      padding: '6px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}%</strong>
        </div>
      ))}
    </div>
  );
}

export default function InterestRatesSection({ region }: Props) {
  const [ratesData, setRatesData]   = useState<RatesData | null>(null);
  const [outlook, setOutlook]       = useState<OutlookTableData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [outlookLoading, setOutlookLoading] = useState(true);
  const [tf, setTf]                 = useState<Timeframe>(DEFAULT_TIMEFRAME);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/rates/${region}`);
      if (r.ok) setRatesData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchOutlook = async () => {
    setOutlookLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/outlook/${region}/policy_rate`);
      if (r.ok) setOutlook(await r.json());
    } catch { /* ignore */ }
    setOutlookLoading(false);
  };

  useEffect(() => {
    fetchRates();
    fetchOutlook();
  }, [region]);

  // Filter each series by timeframe before merging
  const policyArr = filterByTimeframe(ratesData?.policy_rate ?? [], tf);
  const yield2y   = filterByTimeframe(ratesData?.yield_2y   ?? [], tf);
  const yield10y  = filterByTimeframe(ratesData?.yield_10y  ?? [], tf);

  // Merge into single chart dataset keyed by label
  interface RateRow { label: string; policy?: number; y2?: number; y10?: number; }
  const byDate: Record<string, RateRow> = {};
  policyArr.forEach(p => {
    const key = p.label ?? p.date;
    byDate[key] = { ...byDate[key], label: key, policy: p.value };
  });
  yield2y.forEach(p => {
    const key = p.label ?? p.date;
    byDate[key] = { ...byDate[key], label: key, y2: p.value };
  });
  yield10y.forEach(p => {
    const key = p.label ?? p.date;
    byDate[key] = { ...byDate[key], label: key, y10: p.value };
  });
  const chartData = Object.values(byDate).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  // Latest policy rate for the KPI pill
  const latestPolicy = policyArr.length ? policyArr[policyArr.length - 1]?.value : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Latest rate KPI pill ───────────────────────────── */}
      {latestPolicy !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          background: '#111',
          border: '1px solid var(--border)',
          borderRadius: 2,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
        }}>
          <span style={{ color: 'var(--text-muted)' }}>POLICY RATE</span>
          <span style={{ color: 'var(--accent-amber)', fontWeight: 700, fontSize: 13 }}>
            {latestPolicy.toFixed(2)}%
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>
            {policyArr[policyArr.length - 1]?.label}
          </span>
        </div>
      )}

      {/* ── Rates chart ────────────────────────────────────── */}
      <BloombergChartWrapper
        title="Interest Rates"
        subtitle="%"
        isLoading={loading}
        onRefresh={fetchRates}
        height={200}
        selectedTimeframe={tf}
        onTimeframeChange={setTf}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: '#666' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: '#666' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<BbgTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: 'var(--font-mono)', paddingTop: 4 }}
              iconSize={8}
            />
            {policyArr.length > 0 && (
              <Line
                type="stepAfter"
                dataKey="policy"
                name="Policy Rate"
                stroke="#f0a500"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            )}
            {yield2y.length > 0 && (
              <Line
                type="monotone"
                dataKey="y2"
                name="2Y Yield"
                stroke="#5c9dff"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            )}
            {yield10y.length > 0 && (
              <Line
                type="monotone"
                dataKey="y10"
                name="10Y Yield"
                stroke="#00c851"
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </BloombergChartWrapper>

      {/* ── Outlook table ──────────────────────────────────── */}
      <OutlookTable
        data={outlook}
        isLoading={outlookLoading}
        title="Policy Rate Outlook"
        unit="% Year-End"
      />
    </div>
  );
}
