import PocketBase from 'pocketbase';
import type { Document, Tag, FilterState } from '../pages/documents/types';

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8090';

export const pb = new PocketBase(PB_URL);

// ── Auth ──────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return await pb.collection('_superusers').authWithPassword(email, password);
}

export function logout() {
  pb.authStore.clear();
}

export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

// ── Documents ─────────────────────────────────────────────────────────────

function buildFilter(state: FilterState): string {
  const parts: string[] = [];

  if (state.search.trim()) {
    const s = state.search.replace(/'/g, "\\'");
    parts.push(`(filename ~ '${s}' || title ~ '${s}' || notes ~ '${s}')`);
  }

  // "starred" is a client-side concept; for PocketBase we omit status filter
  // and handle it post-fetch so as not to duplicate the starred field query
  if (state.status && state.status !== 'starred') {
    parts.push(`tagging_status = '${state.status}'`);
  }

  return parts.join(' && ');
}

function normDoc(doc: Document): Document {
  return {
    ...doc,
    tags: Array.isArray(doc.tags) ? doc.tags
      : typeof doc.tags === 'string' ? JSON.parse(doc.tags || '[]')
      : [],
    starred: Boolean(doc.starred),
    starred_at: doc.starred_at ?? null,
  };
}

export async function fetchDocuments(filterState: FilterState): Promise<{ items: Document[]; totalItems: number }> {
  // ── Server-side filter (search text + status) ─────────────────────────────
  // Tags are stored as a JSON-type field in PocketBase (arrays of {category,value}
  // objects). Relying on LIKE-based substring matching against PocketBase's
  // Go-re-serialised JSON is brittle, so tag filtering is done client-side.
  // getFullList automatically paginates so there is no arbitrary cutoff at 100.
  const filter = buildFilter(filterState);
  const raw = await pb.collection('documents').getFullList<Document>({
    ...(filter ? { filter } : {}),
    requestKey: null,
  });

  let items = raw.map(normDoc);

  // totalItems reflects the server-filtered count (before client-side tag/starred
  // narrowing). SearchFilter shows "Showing X of totalItems".
  const totalItems = items.length;

  // Sort newest-first — PocketBase v0.23+ has a bug sorting system fields via API.
  items.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));

  // ── Client-side tag filter ────────────────────────────────────────────────
  // Logic: AND across selected categories, OR within each category.
  // e.g. (market=financial_market OR stock_market) AND (instrument=ETF)
  const tagEntries = Object.entries(filterState.tags).filter(([, vals]) => vals.length > 0);
  if (tagEntries.length > 0) {
    items = items.filter(doc =>
      tagEntries.every(([cat, vals]) =>
        doc.tags.some(tag => tag.category === cat && vals.includes(tag.value))
      )
    );
  }

  // ── Client-side starred filter ────────────────────────────────────────────
  if (filterState.status === 'starred') {
    items = items.filter(d => d.starred);
  }

  return { items, totalItems };
}

/** Fetch all starred documents. Optional region filter checks macro tags. */
export async function fetchStarredDocuments(region?: string): Promise<Document[]> {
  // PocketBase bool filter — if the field doesn't exist yet (migration pending)
  // fall back to client-side filter
  try {
    const result = await pb.collection('documents').getList<Document>(1, 200, {
      filter: 'starred = true',
      requestKey: null,
    });
    let items = result.items.map(normDoc);
    if (region) {
      const regionLower = region.toLowerCase();
      items = items.filter(doc =>
        doc.tags.some(
          t => t.category === 'macro' && t.value.toLowerCase().includes(regionLower)
        )
      );
    }
    return items;
  } catch {
    // Migration may not have run yet — return empty
    return [];
  }
}

export async function fetchDocument(id: string): Promise<Document> {
  return normDoc(
    await pb.collection('documents').getOne<Document>(id, { requestKey: null }),
  );
}

export async function uploadDocument(file: File): Promise<Document> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fileTypeMap: Record<string, Document['file_type']> = {
    pdf: 'pdf', docx: 'docx', doc: 'docx',
    csv: 'csv', xlsx: 'xlsx', txt: 'txt', md: 'md',
  };
  const fileType = fileTypeMap[ext] ?? 'txt';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);
  formData.append('title', file.name.replace(/\.[^.]+$/, ''));
  formData.append('file_type', fileType);
  formData.append('file_size_bytes', String(file.size));
  formData.append('tagging_status', 'untagged');
  formData.append('tags', JSON.stringify([]));
  formData.append('notes', '');

  // requestKey: null disables PocketBase's auto-cancellation so parallel uploads
  // to the same collection don't cancel each other.
  return normDoc(
    await pb.collection('documents').create<Document>(formData, { requestKey: null }),
  );
}

export async function saveTags(
  docId: string,
  tags: Tag[],
  title: string,
  summary?: string,
  geminiRaw?: string,
): Promise<Document> {
  return await pb.collection('documents').update<Document>(
    docId,
    {
      tags: JSON.stringify(tags),
      title,
      notes: summary ?? '',
      tagging_status: 'tagged',
      ...(geminiRaw ? { gemini_raw_response: geminiRaw } : {}),
    },
    { requestKey: null },
  );
}

export async function updateDocument(
  docId: string,
  data: Partial<Pick<Document, 'title' | 'notes' | 'tags' | 'tagging_status'>>,
): Promise<Document> {
  const payload: Record<string, unknown> = { ...data };
  if (data.tags) payload.tags = JSON.stringify(data.tags);
  return await pb.collection('documents').update<Document>(docId, payload, { requestKey: null });
}

export async function deleteDocument(docId: string): Promise<void> {
  await pb.collection('documents').delete(docId, { requestKey: null });
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  // Each delete has a unique record ID so keys wouldn't collide by default,
  // but requestKey: null is explicit and future-proof.
  await Promise.all(ids.map(id => pb.collection('documents').delete(id, { requestKey: null })));
}

// ── File URLs ─────────────────────────────────────────────────────────────

export function getFileUrl(doc: Document): string {
  return pb.files.getUrl(doc, doc.file);
}

// ── Database stats ────────────────────────────────────────────────────────

export interface DbStats {
  count: number;
  totalBytes: number;
}

/**
 * Returns the document count and total stored bytes across all records.
 * Uses getFullList so the byte sum is always precise regardless of page size.
 * Fetches only `id` and `file_size_bytes` to keep the payload minimal.
 */
export async function fetchDbStats(): Promise<DbStats> {
  const items = await pb.collection('documents').getFullList<Pick<Document, 'id' | 'file_size_bytes'>>({
    fields: 'id,file_size_bytes',
    requestKey: 'db-stats',
  });
  return {
    count: items.length,
    totalBytes: items.reduce((sum, d) => sum + (d.file_size_bytes ?? 0), 0),
  };
}

// ── Star / unstar ─────────────────────────────────────────────────────────

export async function starDocument(docId: string): Promise<Document> {
  return normDoc(
    await pb.collection('documents').update<Document>(
      docId,
      { starred: true, starred_at: new Date().toISOString() },
      { requestKey: null },
    ),
  );
}

export async function unstarDocument(docId: string): Promise<Document> {
  return normDoc(
    await pb.collection('documents').update<Document>(
      docId,
      { starred: false, starred_at: null },
      { requestKey: null },
    ),
  );
}

// ── Tagging pipeline ──────────────────────────────────────────────────────

export async function extractText(
  fileUrl: string,
  filename: string,
): Promise<{ text: string; char_count: number; extraction_method: string }> {
  const r = await fetch('/api/db/extract-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: fileUrl, filename }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function suggestTags(
  text: string,
  filename: string,
  provider: 'gemini' | 'claude' = 'gemini',
): Promise<{ tags: Array<Tag & { confidence: number }>; suggested_title: string; summary: string }> {
  const r = await fetch('/api/db/suggest-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename, provider }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
