import { useState, useEffect, useCallback } from 'react';
import { fetchDocuments, deleteDocuments, getFileUrl } from '../../lib/pocketbase';
import type { Document, FilterState } from './types';
import { EMPTY_FILTER } from './types';
import DocumentList from './DocumentList';
import SearchFilter from './SearchFilter';
import FileViewer from './FileViewer';
import TagReviewModal from './TagReviewModal';
import { useAutoTag } from '../../context/AutoTagContext';

export default function DatabaseTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDoc, setActiveDoc] = useState<Document | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');

  const { jobs, pendingReview, enqueue, completeReview, dismissReview } = useAutoTag();

  // ── Derived tagging state for DocumentList ────────────────────────────────
  // Show the spinner on whichever doc is currently being processed or reviewed.
  const taggingLoading = jobs.some(
    j => j.status === 'queued' || j.status === 'processing' || j.status === 'pending_review',
  );
  const taggingDocId =
    jobs.find(j => j.status === 'processing')?.docId ??
    jobs.find(j => j.status === 'pending_review')?.docId ??
    null;

  // Queue position for the review modal header (counts only still-active jobs).
  const activeJobs = jobs.filter(
    j => j.status !== 'done' && j.status !== 'error',
  );
  const pendingReviewIndex = pendingReview
    ? activeJobs.findIndex(j => j.id === pendingReview.jobId) + 1
    : 0;

  // ── Data loading ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchDocuments(filter);
      let items = result.items;
      if (sortBy === 'name')
        items = [...items].sort((a, b) => (a.filename ?? '').localeCompare(b.filename ?? ''));
      else if (sortBy === 'status')
        items = [...items].sort((a, b) => (a.tagging_status ?? '').localeCompare(b.tagging_status ?? ''));
      setDocs(items);
      setTotal(result.totalItems);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleDocUploaded(doc: Document) {
    setDocs(prev => [doc, ...prev]);
    setTotal(t => t + 1);
    setActiveDoc(doc);
  }

  function handleDocUpdate(updatedDoc: Document) {
    setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
    // Use functional form to avoid stale-closure issue with activeDoc.
    setActiveDoc(prev => prev?.id === updatedDoc.id ? updatedDoc : prev);
  }

  function handleAutoTag(docIds: string[], provider: 'gemini' | 'claude') {
    if (docIds.length === 0) return;
    const items = docIds
      .map(id => docs.find(d => d.id === id))
      .filter((d): d is Document => !!d)
      .map(d => ({ docId: d.id, fileName: d.filename, fileUrl: getFileUrl(d) }));
    enqueue(items, provider, false, handleDocUpdate);
  }

  function handleAutoTagSilent(docIds: string[], provider: 'gemini' | 'claude') {
    if (docIds.length === 0) return;
    const items = docIds
      .map(id => docs.find(d => d.id === id))
      .filter((d): d is Document => !!d)
      .map(d => ({ docId: d.id, fileName: d.filename, fileUrl: getFileUrl(d) }));
    enqueue(items, provider, true, handleDocUpdate);
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
    handleDocUpdate(updatedDoc);
    if (pendingReview) completeReview(pendingReview.jobId);
  }

  function handleModalClose() {
    if (pendingReview) dismissReview(pendingReview.jobId);
  }

  // The pending-review doc might temporarily be absent from the list if the
  // user is on a filtered view — the modal simply won't render until found.
  const reviewDoc = pendingReview
    ? docs.find(d => d.id === pendingReview.docId) ?? null
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

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
            onAutoTagSilent={handleAutoTagSilent}
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

      {/* Review modal — only rendered when this tab is mounted and the doc is visible */}
      {pendingReview && reviewDoc && (
        <TagReviewModal
          doc={reviewDoc}
          result={pendingReview.result}
          onSaved={handleTagSaved}
          onClose={handleModalClose}
          queueIndex={pendingReviewIndex}
          queueTotal={activeJobs.length}
        />
      )}
    </div>
  );
}
