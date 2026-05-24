import { useState, useEffect } from 'react';
import mammoth from 'mammoth';

interface Props { url: string }

export default function DocxViewer({ url }: Props) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then(result => setHtml(result.value))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return <div className="db-viewer-loading">CONVERTING DOCX...</div>;
  if (error) return <div className="error-msg">DOCX error: {error}</div>;

  return (
    <div
      className="db-docx-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
