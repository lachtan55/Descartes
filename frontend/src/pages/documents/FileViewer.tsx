import { useState, useEffect, lazy, Suspense } from 'react';
import { getFileUrl } from '../../lib/pocketbase';
import type { Document } from './types';

const PdfViewer = lazy(() => import('./viewers/PdfViewer'));
const DocxViewer = lazy(() => import('./viewers/DocxViewer'));
const CsvViewer = lazy(() => import('./viewers/CsvViewer'));
const MarkdownViewer = lazy(() => import('./viewers/MarkdownViewer'));

interface Props {
  doc: Document | null;
}

function ViewerShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="db-viewer-loading">LOADING VIEWER...</div>}>
      {children}
    </Suspense>
  );
}

export default function FileViewer({ doc }: Props) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) { setFileUrl(null); return; }
    setFileUrl(getFileUrl(doc));
  }, [doc]);

  if (!doc || !fileUrl) {
    return (
      <div className="db-viewer-empty">
        <div>SELECT A DOCUMENT</div>
        <div style={{ fontSize: 10, marginTop: 8, color: 'var(--text-muted)' }}>
          Click a document from the list to preview it here
        </div>
      </div>
    );
  }

  const type = doc.file_type;

  return (
    <div className="db-viewer-container">
      <div className="db-viewer-header">
        <span className="db-viewer-filename">{doc.title || doc.filename}</span>
        <a
          href={fileUrl}
          download={doc.filename}
          className="btn-xs"
          style={{ textDecoration: 'none' }}
        >
          ↓ DOWNLOAD
        </a>
      </div>

      <div className="db-viewer-content">
        {type === 'pdf' && (
          <ViewerShell>
            <PdfViewer url={fileUrl} />
          </ViewerShell>
        )}
        {(type === 'docx') && (
          <ViewerShell>
            <DocxViewer url={fileUrl} />
          </ViewerShell>
        )}
        {(type === 'csv' || type === 'xlsx') && (
          <ViewerShell>
            <CsvViewer url={fileUrl} fileType={type} />
          </ViewerShell>
        )}
        {(type === 'txt' || type === 'md') && (
          <ViewerShell>
            <MarkdownViewer url={fileUrl} isMarkdown={type === 'md'} />
          </ViewerShell>
        )}
      </div>
    </div>
  );
}
