import { useState } from 'react';
import type { FilterState } from './types';
import { FIXED_VALUES, TAG_COLORS, CATEGORY_LABELS } from './taxonomy';

interface Props {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  total: number;
  shown: number;
}

const FILTER_CATS = Object.keys(FIXED_VALUES);

export default function SearchFilter({ filter, onChange, total, shown }: Props) {
  const [openCat, setOpenCat] = useState<string | null>(null);

  function setSearch(s: string) {
    onChange({ ...filter, search: s });
  }

  function setStatus(s: string) {
    onChange({ ...filter, status: s });
  }

  function toggleTagValue(cat: string, val: string) {
    const current = filter.tags[cat] ?? [];
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val];
    const tags = { ...filter.tags };
    if (next.length === 0) delete tags[cat];
    else tags[cat] = next;
    onChange({ ...filter, tags });
  }

  function clearAll() {
    onChange({ search: '', status: '', tags: {} });
  }

  const activeTagChips: Array<{ cat: string; val: string }> = Object.entries(filter.tags)
    .flatMap(([cat, vals]) => vals.map(val => ({ cat, val })));

  const hasAnyFilter = filter.search || filter.status || activeTagChips.length > 0;

  return (
    <div className="db-search-bar">
      <div className="db-search-row">
        <input
          className="inp db-search-input"
          placeholder="Search filename, title, notes..."
          value={filter.search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="inp"
          style={{ width: 150 }}
          value={filter.status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">ALL STATUS</option>
          <option value="untagged">UNTAGGED</option>
          <option value="pending_review">PENDING</option>
          <option value="tagged">TAGGED</option>
          <option value="starred">★ STARRED</option>
        </select>

        {FILTER_CATS.map(cat => {
          const active = (filter.tags[cat] ?? []).length > 0;
          return (
            <div key={cat} className="db-filter-dropdown-wrapper">
              <button
                className={`btn-xs${active ? ' amber' : ''}`}
                onClick={() => setOpenCat(openCat === cat ? null : cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}{active ? ` (${filter.tags[cat].length})` : ' ▾'}
              </button>
              {openCat === cat && (
                <div className="db-filter-dropdown" onMouseLeave={() => setOpenCat(null)}>
                  {FIXED_VALUES[cat].map(val => {
                    const checked = (filter.tags[cat] ?? []).includes(val);
                    return (
                      <label key={val} className="db-filter-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTagValue(cat, val)}
                        />
                        <span style={{ color: checked ? TAG_COLORS[cat] : undefined }}>
                          {val}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {hasAnyFilter && (
          <button className="btn-xs red" onClick={clearAll}>CLEAR</button>
        )}
      </div>

      {activeTagChips.length > 0 && (
        <div className="db-active-chips">
          {activeTagChips.map(({ cat, val }) => (
            <span
              key={`${cat}:${val}`}
              className="db-tag-chip"
              style={{ borderColor: TAG_COLORS[cat], color: TAG_COLORS[cat] }}
              onClick={() => toggleTagValue(cat, val)}
            >
              {cat}:{val} ×
            </span>
          ))}
        </div>
      )}

      <div className="db-result-count">
        Showing {shown} of {total} documents
      </div>
    </div>
  );
}
