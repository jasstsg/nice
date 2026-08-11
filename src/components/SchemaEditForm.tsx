import { useEffect, useState } from 'react';
import { api } from '../api';
import SchemaFieldRow from './SchemaFieldRow';
import type { FieldDef, SchemaDef, SchemaListItem } from '../../types/domain';

export interface SchemaEditFormProps {
  path: string | null;
  onSaved: (path: string) => void;
  onDeleted: (path: string) => void;
  onClose: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

interface SchemaSourceResponse {
  path: string;
  raw: string;
}

const BLANK_DEF: SchemaDef = { name: '', label: '', fields: [] };

// path is fixed for the lifetime of a mount - App remounts this component
// (via a key derived from path) whenever it changes, so this effect only
// ever needs to run once.
export default function SchemaEditForm({ path, onSaved, onDeleted, onClose, onStatus }: SchemaEditFormProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(path);
  const [pathInput, setPathInput] = useState(path || '');
  const [def, setDef] = useState<SchemaDef>(BLANK_DEF);
  const [schemaNames, setSchemaNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [list] = await Promise.all([api<SchemaListItem[]>('/api/schemas')]);
      let loadedDef = BLANK_DEF;
      if (path) {
        const res = await api<SchemaSourceResponse>(`/api/schema-files/content?path=${encodeURIComponent(path)}`);
        try {
          const parsed = JSON.parse(res.raw);
          loadedDef = { name: parsed.name || '', label: parsed.label || '', fields: Array.isArray(parsed.fields) ? parsed.fields : [] };
        } catch {
          onStatus('This file has invalid JSON - starting from a blank schema. Edit the file directly if you want to recover its contents.', true);
        }
      }
      if (!cancelled) {
        // Editing an existing schema shouldn't offer itself as an
        // object/reference target for its own fields.
        setSchemaNames(list.map((s) => s.name).filter((n) => n !== loadedDef.name));
        setDef(loadedDef);
        setLoaded(true);
      }
    }
    load().catch((err) => onStatus(err.message, true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(idx: number, field: FieldDef) {
    setDef({ ...def, fields: def.fields.map((f, i) => (i === idx ? field : f)) });
  }
  function removeField(idx: number) {
    setDef({ ...def, fields: def.fields.filter((_, i) => i !== idx) });
  }
  function moveField(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= def.fields.length) return;
    const next = def.fields.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setDef({ ...def, fields: next });
  }
  function addField() {
    setDef({ ...def, fields: [...def.fields, { name: '', type: 'string' }] });
  }

  async function handleSave() {
    try {
      const raw = JSON.stringify(def, null, 2) + '\n';
      let savedPath = currentPath;
      if (currentPath) {
        await api(`/api/schema-files/content?path=${encodeURIComponent(currentPath)}`, { method: 'PUT', body: { raw } });
      } else {
        const newPath = pathInput.trim();
        if (!newPath) throw new Error('Enter a file path first');
        const result = await api<{ path: string }>('/api/schema-files/content', {
          method: 'POST',
          body: { path: newPath, raw }
        });
        savedPath = result.path;
        setCurrentPath(result.path);
      }
      onStatus('Saved.');
      onSaved(savedPath as string);
    } catch (err) {
      onStatus((err as Error).message, true);
    }
  }

  async function handleDelete() {
    if (!currentPath) return;
    if (!window.confirm('Delete this schema file? Content created from it will no longer be recognized.')) return;
    try {
      await api(`/api/schema-files/content?path=${encodeURIComponent(currentPath)}`, { method: 'DELETE' });
      onStatus('Deleted.');
      onDeleted(currentPath);
    } catch (err) {
      onStatus((err as Error).message, true);
    }
  }

  if (!loaded) return <p className="placeholder">Loading…</p>;

  return (
    <div>
      <span className="schema-badge">SCHEMA</span>
      <h2>{currentPath || 'New schema'}</h2>

      <div className="field">
        <label>File path (relative to the project root)</label>
        <input
          type="text"
          value={pathInput}
          disabled={!!currentPath}
          placeholder="schemas/my-schema.nice-schema.json"
          onChange={(e) => setPathInput(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Schema name</label>
        <input type="text" value={def.name} onChange={(e) => setDef({ ...def, name: e.target.value })} />
      </div>

      <div className="field">
        <label>Display label (optional)</label>
        <input type="text" value={def.label || ''} onChange={(e) => setDef({ ...def, label: e.target.value })} />
      </div>

      <div className="field">
        <label>Fields</label>
        {def.fields.length === 0 && <p className="placeholder">No fields yet.</p>}
        {def.fields.map((field, idx) => (
          <SchemaFieldRow
            key={idx}
            field={field}
            onChange={(f) => updateField(idx, f)}
            onRemove={() => removeField(idx)}
            onMoveUp={() => moveField(idx, -1)}
            onMoveDown={() => moveField(idx, 1)}
            schemaNames={schemaNames}
          />
        ))}
        <button type="button" onClick={addField}>+ Add field</button>
      </div>

      <button type="button" onClick={handleSave}>Save</button>
      {currentPath && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      <button type="button" className="ghost" onClick={onClose}>Close</button>
    </div>
  );
}
