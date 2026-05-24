import { useState } from 'react';
import { Document as PdfDoc, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props { url: string }

export default function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  function onLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  return (
    <div className="db-pdf-viewer">
      <div className="db-pdf-controls">
        <button className="btn-xs" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
          ◄ PREV
        </button>
        <span className="db-pdf-pagenum">
          {pageNumber} / {numPages || '?'}
        </span>
        <button className="btn-xs" onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
          NEXT ►
        </button>
        <button className="btn-xs" onClick={() => setScale(s => Math.max(0.4, s - 0.2))}>− ZOOM</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          {Math.round(scale * 100)}%
        </span>
        <button className="btn-xs" onClick={() => setScale(s => Math.min(2.5, s + 0.2))}>+ ZOOM</button>
        <button className="btn-xs" onClick={() => setScale(1.0)}>RESET</button>
      </div>

      <div className="db-pdf-page-wrap">
        <PdfDoc
          file={url}
          onLoadSuccess={onLoadSuccess}
          loading={<div className="db-viewer-loading">RENDERING PDF...</div>}
          error={<div className="error-msg">Failed to load PDF</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </PdfDoc>
      </div>
    </div>
  );
}
