import { useEffect, useState } from 'react';
import { api } from '../api';

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

// path is fixed for the lifetime of a mount - App remounts this component
// (via a key derived from path) whenever it changes, so this effect only
// ever needs to run once.
export default function SchemaEditForm({ path, onSaved, onDeleted, onClose, onStatus }: SchemaEditFormProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(path);
  const [pathInput, setPathInput] = useState(path || '');
  const [raw, setRaw] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (path) {
        const res = await api<SchemaSourceResponse>(`/api/schema-files/content?path=${encodeURIComponent(path)}`);
        if (!cancelled) {
          setRaw(res.raw);
          setLoaded(true);
        }
      } else {
        const blank = { name: '', label: '', fields: [] };
        if (!cancelled) {
          setRaw(JSON.stringify(blank, null, 2) + '\n');
          setLoaded(true);
        }
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
        <label>Schema JSON</label>
        <textarea className="json-editor" value={raw} onChange={(e) => setRaw(e.target.value)} />
      </div>

      <button type="button" onClick={handleSave}>Save</button>
      {currentPath && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      <button type="button" className="ghost" onClick={onClose}>Close</button>
    </div>
  );
}
