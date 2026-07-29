import { useEffect, useState } from 'react';
import { api } from '../api';
import type { SchemaListItem } from '../../types/domain';

export interface SchemaPickerProps {
  onPick: (schemaName: string) => void;
  onCancel: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

// Type-to-filter list, shown when creating new content - replaces a plain
// <select> dropdown that doesn't scale once there are more than a handful
// of schemas to pick from.
export default function SchemaPicker({ onPick, onCancel, onStatus }: SchemaPickerProps) {
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api<SchemaListItem[]>('/api/schemas')
      .then(setSchemas)
      .catch((err) => onStatus(err.message, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = schemas.filter((s) => (s.label || s.name).toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <h2>New content — choose a schema</h2>
      <input
        type="text"
        autoFocus
        placeholder="Type to filter…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="picker-search"
      />
      <ul className="item-list">
        {filtered.map((s) => (
          <li key={s.name}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPick(s.name);
              }}
            >
              {s.label || s.name}
            </a>
          </li>
        ))}
        {filtered.length === 0 && <li className="tree-empty">No matching schemas</li>}
      </ul>
      <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}
