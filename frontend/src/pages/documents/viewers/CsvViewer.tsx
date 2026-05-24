import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Props {
  url: string;
  fileType: 'csv' | 'xlsx';
}

export default function CsvViewer({ url, fileType }: Props) {
  const [sheets, setSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [data, setData] = useState<string[][]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const workbook = XLSX.read(buf, { type: 'array' });
        setWb(workbook);
        setSheets(workbook.SheetNames);
        const first = workbook.SheetNames[0];
        setActiveSheet(first);
        const sheet = workbook.Sheets[first];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        setData(rows as string[][]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  function selectSheet(name: string) {
    if (!wb) return;
    setActiveSheet(name);
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
    setData(rows as string[][]);
  }

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  if (loading) return <div className="db-viewer-loading">PARSING SPREADSHEET...</div>;
  if (error) return <div className="error-msg">Parse error: {error}</div>;
  if (data.length === 0) return <div className="empty-msg">Empty spreadsheet</div>;

  const headers = data[0] ?? [];
  const totalWidth = Math.max(headers.length * 120, 600);

  return (
    <div className="db-csv-viewer">
      {sheets.length > 1 && (
        <div className="db-sheet-tabs">
          {sheets.map(s => (
            <button
              key={s}
              className={`btn-xs${activeSheet === s ? ' amber' : ''}`}
              onClick={() => selectSheet(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="db-csv-header-row" style={{ minWidth: totalWidth }}>
        <div className="db-csv-row-num" />
        {headers.map((h, i) => (
          <div key={i} className="db-csv-cell db-csv-header">{String(h)}</div>
        ))}
      </div>

      <div ref={parentRef} className="db-csv-body" style={{ height: 'calc(100% - 56px)', overflow: 'auto' }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', minWidth: totalWidth }}>
          {rowVirtualizer.getVirtualItems().map(vRow => {
            if (vRow.index === 0) return null;
            const row = data[vRow.index] ?? [];
            return (
              <div
                key={vRow.index}
                className={`db-csv-row ${vRow.index % 2 === 0 ? 'row-even' : 'row-odd'}`}
                style={{ position: 'absolute', top: vRow.start, left: 0, width: '100%', height: vRow.size }}
              >
                <div className="db-csv-row-num">{vRow.index}</div>
                {headers.map((_, ci) => (
                  <div key={ci} className="db-csv-cell">{String(row[ci] ?? '')}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
