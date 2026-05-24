import { useState, useRef } from 'react';
import { uploadDocument } from '../../lib/pocketbase';
import type { Document } from './types';

interface UploadState {
  name: string;
  progress: number;
  done: boolean;
  error: string;
}

interface Props {
  onUpload: (doc: Document) => void;
}

const ACCEPTED_EXTS = new Set(['pdf', 'docx', 'doc', 'csv', 'xlsx', 'txt', 'md']);

function validateFile(f: File): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_EXTS.has(ext)) return `Unsupported type: .${ext}`;
  if (f.size > 100 * 1024 * 1024) return 'File too large (max 100 MB)';
  return null;
}

export default function UploadZone({ onUpload }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFiles(files: File[]) {
    const valid = files.filter(f => {
      const err = validateFile(f);
      if (err) setUploads(prev => [...prev, { name: f.name, progress: 0, done: false, error: err }]);
      return !err;
    });
    if (!valid.length) return;

    setUploads(prev => [
      ...prev,
      ...valid.map(f => ({ name: f.name, progress: 10, done: false, error: '' })),
    ]);

    await Promise.all(valid.map(async file => {
      try {
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, progress: 40 } : u));
        const doc = await uploadDocument(file);
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, progress: 100, done: true } : u));
        onUpload(doc);
        setTimeout(() => {
          setUploads(prev => prev.filter(u => !(u.name === file.name && u.done)));
        }, 3000);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, error: msg } : u));
      }
    }));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  }

  if (uploads.length === 0) {
    return (
      <div
        className={`drop-zone db-drop-zone${dragOver ? ' active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        DROP FILES HERE — PDF · DOCX · CSV · XLSX · TXT · MD — MAX 100 MB
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.csv,.xlsx,.txt,.md"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <div className="db-upload-progress">
      {uploads.map((u, i) => (
        <div key={i} className="db-upload-item">
          <span className="db-upload-name" title={u.name}>{u.name}</span>
          {u.error ? (
            <span style={{ color: 'var(--accent-red)', fontSize: 10 }}>{u.error}</span>
          ) : u.done ? (
            <span style={{ color: '#00FF41', fontSize: 10 }}>✓ DONE</span>
          ) : (
            <div className="db-progress-bar">
              <div className="db-progress-fill" style={{ width: `${u.progress}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
