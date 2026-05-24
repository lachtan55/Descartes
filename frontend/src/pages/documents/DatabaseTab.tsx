import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDocuments, deleteDocuments, extractText, suggestTags, getFileUrl } from '../../lib/pocketbase';
import type { Document, FilterState, GeminiResult } from './types';
import { EMPTY_FILTER } from './types';
import DocumentList from './DocumentList';
import SearchFilter from './SearchFilter';
import FileViewer from './FileViewer';
import TagReviewModal from './TagReviewModal';

export default function DatabaseTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');

  // Tag review modal state
  const [taggingDocId, setTaggingDocId] = useState<string | null>(null);
  const [taggingResult, setTaggingResult] = useState<GeminiResult | null>(null);
  const [taggingLoading, setTaggingLoading] = useState(false);
  const [taggingError, setTaggingError] = useState('');

  // Queue for bulk auto-tag
  const taggingQueueRef = useRef<string[]>([]);
  const [taggingBatchTotal, setTaggingBatchTotal] = useState(0);
  const [taggingBatchIndex, setTaggingBatchIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchDocuments(filter);
      let items = result.items;

      if (sortBy === 'name') items = [...items].sort((a, b) => (a.filename ?? '').localeCompare(b.filename ?? ''));
      else if (sortBy === 'status') items = [...items].sort((a, b) => (a.tagging_status ?? '').localeCompare(b.tagging_status ?? ''));

      setDocs(items);
      setTotal(result.totalItems);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy]);

  useEffect(() => { load(); }, [load]);

  function handleDocUploaded(doc: Document) {
    setDocs(prev => [doc, ...prev]);
    setTotal(t => t + 1);
    setActiveDoc(doc);
  }

  async function processDoc(docId: string) {
    const doc = docs.find(d => d.id === docId);
    if (!doc) {
      advanceQueue();
      return;
    }
    setTaggingDocId(doc.id);
    setTaggingLoading(true);
    setTaggingError('');
    setTaggingResult(null);
    try {
      const fileUrl = getFileUrl(doc);
      const { text } = await extractText(fileUrl, doc.filename);
      const result = await suggestTags(text, doc.filename);
      setTaggingResult(result);
    } catch (e: unknown) {
      setTaggingError(e instanceof Error ? e.message : 'Tagging failed');
      setTaggingDocId(null);
    } finally {
      setTaggingLoading(false);
    }
  }

  function advanceQueue() {
    const [next, ...rest] = taggingQueueRef.current;
    if (!next) {
      setTaggingBatchTotal(0);
      setTaggingBatchIndex(0);
      return;
    }
    taggingQueueRef.current = rest;
    setTaggingBatchIndex(i => i + 1);
    processDoc(next);
  }

  function handleAutoTag(docIds: string[]) {
    if (docIds.length === 0) return;
    taggingQueueRef.current = docIds.slice(1);
    setTaggingBatchTotal(docIds.length);
    setTaggingBatchIndex(1);
    processDoc(docIds[0]);
  }

  async function handleBulkDelete(ids: string[]) {
    const msg = ids.length === 1
      ? 'Delete this document? This cannot be undone.'
      : `Delete ${ids.length} documents? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      await deleteDocuments(ids);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.delete(id));
      return next;
    });
    if (activeDoc && ids.includes(activeDoc.id)) setActiveDoc(null);
    load();
  }

  function handleTagSaved(updatedDoc: Document) {
    setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    if (activeDoc?.id === updatedDoc.id) setActiveDoc(updatedDoc);
    setTaggingDocId(null);
    setTaggingResult(null);
    advanceQueue();
  }

  function handleDocUpdate(updatedDoc: Document) {
    setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    if (activeDoc?.id === updatedDoc.id) setActiveDoc(updatedDoc);
  }

  function handleModalClose() {
    taggingQueueRef.current = [];
    setTaggingBatchTotal(0);
    setTaggingBatchIndex(0);
    setTaggingDocId(null);
    setTaggingResult(null);
  }

  return (
    <div className="database-layout">
      <SearchFilter
        filter={filter}
        onChange={setFilter}
        total={total}
        shown={docs.length}
      />

      <div className="database-panels">
        <div className="database-left-panel">
          <DocumentList
            docs={docs}
            loading={loading}
            error={error}
            selected={selected}
            onSelectChange={setSelected}
            activeDocId={activeDoc?.id ?? null}
            onDocClick={setActiveDoc}
            onUpload={handleDocUploaded}
            onAutoTag={handleAutoTag}
            onDelete={handleBulkDelete}
            onDocUpdate={handleDocUpdate}
            taggingLoading={taggingLoading}
            taggingDocId={taggingDocId}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        <div className="database-right-panel">
          <FileViewer doc={activeDoc} />
        </div>
      </div>

      {taggingDocId && taggingResult && (
        <TagReviewModal
          doc={docs.find(d => d.id === taggingDocId)!}
          result={taggingResult}
          onSaved={handleTagSaved}
          onClose={handleModalClose}
          queueIndex={taggingBatchIndex}
          queueTotal={taggingBatchTotal}
        />
      )}

      {taggingError && (
        <div className="modal-overlay" onClick={() => setTaggingError('')}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">TAGGING ERROR</div>
            <div className="error-msg">{taggingError}</div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn-secondary" onClick={() => setTaggingError('')}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
