import { useEffect, useState } from 'react';
import { api } from '../api';
import { useSchemaDeps } from '../hooks/useSchemaDeps';
import Field from './Field';
import type { SchemaDef } from '../../types/domain';

export interface ContentEditFormProps {
  schemaName: string;
  id: string | null;
  onSaved: (schemaName: string, id: string) => void;
  onDeleted: (schemaName: string, id: string) => void;
  onClose: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

interface ContentReadResponse {
  data: Record<string, unknown>;
  path: string;
}

interface SaveResponse {
  id: string;
  path: string;
}

// schemaName/id are fixed for the lifetime of a mount - App remounts this
// component (via a key derived from schema+id) whenever either changes, so
// this effect only ever needs to run once.
export default function ContentEditForm({ schemaName, id, onSaved, onDeleted, onClose, onStatus }: ContentEditFormProps) {
  const [schema, setSchema] = useState<SchemaDef | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [path, setPath] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(id);
  const { deps, loading: depsLoading } = useSchemaDeps(schema);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const s = await api<SchemaDef>(`/api/schemas/${encodeURIComponent(schemaName)}`);
      let d: Record<string, unknown> = {};
      let p: string | null = null;
      if (id) {
        const res = await api<ContentReadResponse>(`/api/content/${encodeURIComponent(schemaName)}/${encodeURIComponent(id)}`);
        d = res.data;
        p = res.path;
      }
      if (!cancelled) {
        setSchema(s);
        setData(d);
        setPath(p);
      }
    }
    load().catch((err) => onStatus(err.message, true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    try {
      const wasNew = !editingId;
      const method = editingId ? 'PUT' : 'POST';
      let url = editingId
        ? `/api/content/${encodeURIComponent(schemaName)}/${encodeURIComponent(editingId)}`
        : `/api/content/${encodeURIComponent(schemaName)}`;
      if (wasNew && pathInput.trim()) {
        url += `?path=${encodeURIComponent(pathInput.trim())}`;
      }
      const result = await api<SaveResponse>(url, { method, body: data });
      setEditingId(result.id);
      setPath(result.path);
      onStatus('Saved.');
      onSaved(schemaName, result.id);
    } catch (err) {
      onStatus((err as Error).message, true);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!window.confirm('Delete this item?')) return;
    try {
      await api(`/api/content/${encodeURIComponent(schemaName)}/${encodeURIComponent(editingId)}`, { method: 'DELETE' });
      onStatus('Deleted.');
      onDeleted(schemaName, editingId);
    } catch (err) {
      onStatus((err as Error).message, true);
    }
  }

  if (!schema || depsLoading || !deps) return <p className="placeholder">Loading…</p>;

  return (
    <div>
      <span className="content-badge">CONTENT</span>
      <h2>{schema.label || schema.name} {editingId ? '(editing)' : '(new)'}</h2>

      {editingId ? (
        <div className="field">
          <label>File</label>
          <div className="path-display">{path || '(unknown)'}</div>
        </div>
      ) : (
        <div className="field">
          <label>File path (optional — leave blank to auto-generate under content/{schemaName}/)</label>
          <input
            type="text"
            placeholder={`content/${schemaName}.json`}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
          />
        </div>
      )}

      {schema.fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={data[field.name]}
          onChange={(v) => setData((prev) => ({ ...prev, [field.name]: v }))}
          deps={deps}
        />
      ))}

      <button type="button" onClick={handleSave}>Save</button>
      {editingId && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      <button type="button" className="ghost" onClick={onClose}>Close</button>
    </div>
  );
}
