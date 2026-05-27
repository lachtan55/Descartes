/**
 * AutoTagContext — global document-tagging queue.
 *
 * Processes ONE job at a time sequentially. Each job either:
 *   - silent=true  → extract text + suggest + auto-save (confidence ≥ 0.5), fires onDocUpdated callback.
 *   - silent=false → extract text + suggest, then pauses with pendingReview so DatabaseTab
 *                    can render TagReviewModal. After the user saves/dismisses,
 *                    call completeReview / dismissReview to advance the queue.
 *
 * AutoTagProgressBar (rendered inside SectionShell) reads this context to show a
 * live progress strip across all section pages.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { extractText, suggestTags, saveTags } from '../lib/pocketbase';
import type { Document, GeminiResult } from '../pages/documents/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutoTagStatus = 'queued' | 'processing' | 'pending_review' | 'done' | 'error';

export interface AutoTagJob {
  /** Unique job ID — equals docId so duplicate enqueues are silently deduped. */
  id: string;
  docId: string;
  fileName: string;
  fileUrl: string;
  provider: 'gemini' | 'claude';
  silent: boolean;
  status: AutoTagStatus;
  error?: string;
}

export interface PendingReview {
  jobId: string;
  docId: string;
  result: GeminiResult;
}

interface AutoTagContextValue {
  jobs: AutoTagJob[];
  pendingReview: PendingReview | null;
  /** True while any job is queued, processing, or awaiting review. */
  isActive: boolean;
  enqueue: (
    items: Array<{ docId: string; fileName: string; fileUrl: string }>,
    provider: 'gemini' | 'claude',
    silent: boolean,
    onDocUpdated?: (doc: Document) => void,
  ) => void;
  /** Call after TagReviewModal successfully saves — advances the queue. */
  completeReview: (jobId: string) => void;
  /** Call when user closes the modal without saving — marks job as error, advances queue. */
  dismissReview: (jobId: string) => void;
  /** Removes all done/error jobs from the list. */
  clearCompleted: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AutoTagContext = createContext<AutoTagContextValue>({
  jobs: [],
  pendingReview: null,
  isActive: false,
  enqueue: () => {},
  completeReview: () => {},
  dismissReview: () => {},
  clearCompleted: () => {},
});

export function useAutoTag(): AutoTagContextValue {
  return useContext(AutoTagContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AutoTagProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<AutoTagJob[]>([]);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);

  // Guards against starting a second worker while one is already in flight.
  const processingRef = useRef(false);
  // Callbacks supplied by callers for silent-mode doc updates (keyed by jobId / docId).
  const docUpdateCallbacksRef = useRef<Map<string, (doc: Document) => void>>(new Map());

  // ── Sequential processor ──────────────────────────────────────────────────
  // Runs after every jobs/pendingReview state change. Starts the next queued
  // job unless the queue is already occupied.

  useEffect(() => {
    if (processingRef.current || pendingReview) return;

    const next = jobs.find(j => j.status === 'queued');
    if (!next) return;

    processingRef.current = true;
    setJobs(prev => prev.map(j => j.id === next.id ? { ...j, status: 'processing' } : j));

    (async () => {
      try {
        const { text } = await extractText(next.fileUrl, next.fileName);
        const result = await suggestTags(text, next.fileName, next.provider);

        if (next.silent) {
          // Auto-save — accept tags with confidence ≥ 50 %.
          const tags = result.tags
            .filter(t => t.confidence >= 0.5)
            .map(({ category, value }) => ({ category, value }));
          const updated = await saveTags(
            next.docId,
            tags,
            result.suggested_title || next.fileName,
            result.summary,
          );
          docUpdateCallbacksRef.current.get(next.id)?.(updated);
          setJobs(prev => prev.map(j => j.id === next.id ? { ...j, status: 'done' } : j));
          processingRef.current = false;
        } else {
          // Pause — DatabaseTab will render TagReviewModal when it sees pendingReview.
          setJobs(prev => prev.map(j => j.id === next.id
            ? { ...j, status: 'pending_review' }
            : j
          ));
          setPendingReview({ jobId: next.id, docId: next.docId, result });
          processingRef.current = false;
        }
      } catch (e: unknown) {
        // Extract the FastAPI `detail` field from JSON error bodies when present.
        const raw = e instanceof Error ? e.message : String(e);
        let detail = raw;
        if (raw.includes('{')) {
          try { detail = (JSON.parse(raw) as { detail?: string }).detail ?? raw; } catch { /* keep raw */ }
        }
        // Make the "missing API key" error user-readable.
        const friendly = detail.includes('ANTHROPIC_API_KEY not configured')
          ? 'Claude API key not set in backend/.env'
          : detail;
        setJobs(prev => prev.map(j => j.id === next.id
          ? { ...j, status: 'error', error: friendly }
          : j
        ));
        processingRef.current = false;
      }
    })();
  }, [jobs, pendingReview]);

  // ── Public API ────────────────────────────────────────────────────────────

  const enqueue = useCallback((
    items: Array<{ docId: string; fileName: string; fileUrl: string }>,
    provider: 'gemini' | 'claude',
    silent: boolean,
    onDocUpdated?: (doc: Document) => void,
  ) => {
    setJobs(prev => {
      const existingIds = new Set(prev.map(j => j.id));
      const fresh = items
        .filter(it => !existingIds.has(it.docId))
        .map(it => ({
          id:       it.docId,
          docId:    it.docId,
          fileName: it.fileName,
          fileUrl:  it.fileUrl,
          provider,
          silent,
          status: 'queued' as AutoTagStatus,
        }));
      if (onDocUpdated) {
        fresh.forEach(j => docUpdateCallbacksRef.current.set(j.id, onDocUpdated));
      }
      return [...prev, ...fresh];
    });
  }, []);

  const completeReview = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'done' } : j));
    setPendingReview(null);
  }, []);

  const dismissReview = useCallback((jobId: string) => {
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, status: 'error', error: 'Review dismissed' }
      : j
    ));
    setPendingReview(null);
  }, []);

  const clearCompleted = useCallback(() => {
    setJobs(prev => {
      const next = prev.filter(j => j.status !== 'done' && j.status !== 'error');
      // Clean up stale callbacks so they don't accumulate across many batches.
      const keepIds = new Set(next.map(j => j.id));
      docUpdateCallbacksRef.current.forEach((_, id) => {
        if (!keepIds.has(id)) docUpdateCallbacksRef.current.delete(id);
      });
      return next;
    });
  }, []);

  const isActive = jobs.some(
    j => j.status === 'queued' || j.status === 'processing' || j.status === 'pending_review',
  );

  return (
    <AutoTagContext.Provider value={{
      jobs,
      pendingReview,
      isActive,
      enqueue,
      completeReview,
      dismissReview,
      clearCompleted,
    }}>
      {children}
    </AutoTagContext.Provider>
  );
}
