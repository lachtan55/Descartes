import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine,
} from 'recharts';
import BloombergChartWrapper from './BloombergChartWrapper';
import OutlookTable from './OutlookTable';
import type { CPIData, OutlookTable as OutlookTableData } from '../types';
import { REGION_MAP } from '../../../config/regionConfig';
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
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>%
        </div>
      ))}
    </div>
  );
}

export default function CPISection({ region }: Props) {
  const [cpiData, setCpiData]       = useState<CPIData | null>(null);
  const [outlook, setOutlook]       = useState<OutlookTableData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [outlookLoading, setOutlookLoading] = useState(true);
  const [tf, setTf]                 = useState<Timeframe>(DEFAULT_TIMEFRAME);

  const regionCfg = REGION_MAP[region];
  const cbTarget  = regionCfg?.cbTarget ?? '';
  const targetLine = cbTarget.includes('2%') ? 2.0 : null;

  const fetchCPI = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/cpi/${region}`);
      if (r.ok) setCpiData(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchOutlook = async () => {
    setOutlookLoading(true);
    try {
      const r = await fetch(`${API}/api/macro/outlook/${region}/cpi`);
      if (r.ok) setOutlook(await r.json());
    } catch { /* ignore */ }
    setOutlookLoading(false);
  };

  useEffect(() => {
    fetchCPI();
    fetchOutlook();
  }, [region]);

  // Filter by timeframe before merging
  const cpiArr  = filterByTimeframe(cpiData?.cpi      ?? [], tf);
  const coreArr = filterByTimeframe(cpiData?.core_cpi ?? [], tf);

  // Merge CPI + Core CPI into single data array keyed by label
  const byDate: Record<string, { label: string; cpi?: number; core_cpi?: number }> = {};
  cpiArr.forEach(p => {
    const key = p.label ?? p.date;
    byDate[key] = { ...byDate[key], label: key, cpi: p.value };
  });
  coreArr.forEach(p => {
    const key = p.label ?? p.date;
    byDate[key] = { ...byDate[key], label: key, core_cpi: p.value };
  });
  const mergedData = Object.values(byDate).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── CPI overlay chart ──────────────────────────────── */}
      <BloombergChartWrapper
        title="Inflation"
        subtitle={
          region === 'Eurozone' || region === 'Germany' ? 'HICP YoY %' : 'CPI YoY %'
        }
        isLoading={loading}
        onRefresh={fetchCPI}
        height={200}
        selectedTimeframe={tf}
        onTimeframeChange={setTf}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mergedData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
            {targetLine && (
              <ReferenceLine
                y={targetLine}
                stroke="#f0a500"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
                label={{
                  value: `${targetLine}% target`,
                  fill: '#666',
                  fontSize: 8,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            )}
            <Tooltip content={<BbgTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: 'var(--font-mono)', paddingTop: 4 }}
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="cpi"
              name={region === 'US' ? 'CPI' : 'HICP'}
              stroke="#ff6a00"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls
            />
            {cpiData?.core_cpi && cpiData.core_cpi.length > 0 && (
              <Line
                type="monotone"
                dataKey="core_cpi"
                name="Core CPI"
                stroke="#f0a500"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </BloombergChartWrapper>

      {/* ── CB target note ─────────────────────────────────── */}
      {cbTarget && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          padding: '2px 0',
        }}>
          {regionCfg?.centralBank} target: {cbTarget}
        </div>
      )}

      {/* ── Outlook table ──────────────────────────────────── */}
      <OutlookTable
        data={outlook}
        isLoading={outlookLoading}
        title="CPI Outlook"
        unit="% YoY"
      />
    </div>
  );
}
