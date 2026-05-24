import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import BloombergChartWrapper from './BloombergChartWrapper';
import OutlookTable from './OutlookTable';
import type { GDPData, OutlookTable as OutlookTableData } from '../types';
import { DEFAULT_TIMEFRAME, filterByTimeframe, type Timeframe } from '../utils/timeframe';

interface Props {
  region: string;
}

const API = 'http://localhost:8000';

const TICK = { fontSize: 9, fontFamily: 'var(--font-mono)', fill: '#666' } as const;

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number | string;
  color: string;
  unit?: string;
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
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
          {p.unit ?? ''}
        </div>
      ))}
    </div>
  );
}

export default function GDPSection({ region }: Props) {
  const [gdpData, setGdpData]       = useState<GDPData | null>(null);
  const [outlook, setOutlook]       = useState<OutlookTableData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [outlookLoading, setOutlookLoading] = useState(true);
  const [tf, setTf]                 = useState<Timeframe>(DEFAULT_TIMEFRAME);

  const fetchGDP = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/gdp/${region}`);
      if (r.ok) setGdpData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchOutlook = async () => {
    setOutlookLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/outlook/${region}/gdp_growth`);
      if (r.ok) setOutlook(await r.json());
    } catch { /* ignore */ }
    setOutlookLoading(false);
  };

  useEffect(() => {
    fetchGDP();
    fetchOutlook();
  }, [region]);

  const growthData = filterByTimeframe(gdpData?.growth ?? [], tf);
  const nominalData = filterByTimeframe(gdpData?.nominal ?? [], tf);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── GDP Growth ─────────────────────────────────────── */}
      <BloombergChartWrapper
        title="GDP Growth"
        subtitle="Real % QoQ / YoY"
        isLoading={loading}
        onRefresh={fetchGDP}
        height={190}
        selectedTimeframe={tf}
        onTimeframeChange={setTf}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={growthData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis
              dataKey="label"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<BbgTooltip />} />
            <Bar
              dataKey="value"
              name="GDP Growth"
              fill="#00c851"
              radius={[1, 1, 0, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      </BloombergChartWrapper>

      {/* ── GDP Nominal ────────────────────────────────────── */}
      <BloombergChartWrapper
        title="GDP Nominal"
        subtitle={
          region === 'US'       ? 'Billions USD SAAR' :
          region === 'Japan'    ? 'Trillion JPY' :
          region === 'Czechia'  ? 'Billion CZK' : ''
        }
        isLoading={loading}
        height={170}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={nominalData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis
              dataKey="label"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}T` : `${v}`}
              width={40}
            />
            <Tooltip content={<BbgTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              name="Nominal GDP"
              stroke="#f0a500"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </BloombergChartWrapper>

      {/* ── Outlook table ──────────────────────────────────── */}
      <OutlookTable
        data={outlook}
        isLoading={outlookLoading}
        title="GDP Growth Outlook"
        unit="% Real YoY"
      />
    </div>
  );
}
