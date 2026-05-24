export interface Tag {
  category: string;
  value: string;
}

export interface TagSuggestion extends Tag {
  confidence: number;
}

export interface GeminiResult {
  tags: TagSuggestion[];
  suggested_title: string;
  summary: string;
  gemini_raw_response?: string;
}

export interface Document {
  id: string;
  collectionId: string;
  collectionName: string;
  filename: string;
  file: string;
  title: string;
  notes: string;
  file_type: 'pdf' | 'docx' | 'csv' | 'xlsx' | 'txt' | 'md';
  file_size_bytes: number;
  tags: Tag[];
  tagging_status: 'untagged' | 'pending_review' | 'tagged';
  gemini_raw_response: string;
  starred: boolean;
  starred_at: string | null;
  created: string;
  updated: string;
}

export interface FilterState {
  search: string;
  status: string;
  tags: Record<string, string[]>;
}

export const EMPTY_FILTER: FilterState = {
  search: '',
  status: '',
  tags: {},
};

// Possible values for the status dropdown (includes starred)
export const STATUS_OPTIONS = [
  { value: '',               label: 'ALL STATUS' },
  { value: 'tagged',         label: 'TAGGED' },
  { value: 'untagged',       label: 'UNTAGGED' },
  { value: 'pending_review', label: 'PENDING REVIEW' },
  { value: 'starred',        label: 'STARRED' },     // client-side filter
] as const;
