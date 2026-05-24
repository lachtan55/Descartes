import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  url: string;
  isMarkdown: boolean;
}

export default function MarkdownViewer({ url, isMarkdown }: Props) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(url)
      .then(r => r.text())
      .then(setContent)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return <div className="db-viewer-loading">LOADING...</div>;
  if (error) return <div className="error-msg">Load error: {error}</div>;

  if (!isMarkdown) {
    return <pre className="db-txt-content">{content}</pre>;
  }

  return (
    <div className="db-md-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
