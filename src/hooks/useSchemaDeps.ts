import { useEffect, useState } from 'react';
import { api } from '../api';
import type { SchemaDef, ContentListItem } from '../../types/domain';

export interface SchemaDeps {
  schemas: Record<string, SchemaDef>;
  options: Record<string, ContentListItem[]>;
}

interface UseSchemaDepsState {
  deps: SchemaDeps | null;
  loading: boolean;
  error: string | null;
}

// Recursively fetches every schema/reference-option-list a schema's fields
// touch (embedded objects and reference targets) so Field can render
// synchronously afterwards.
async function preloadDeps(schema: SchemaDef, deps: SchemaDeps, visited: Set<string>): Promise<void> {
  if (visited.has(schema.name)) return;
  visited.add(schema.name);
  deps.schemas[schema.name] = schema;

  for (const field of schema.fields) {
    const target = field.type === 'array' ? field.items : field;
    if (!target) continue;

    if (target.type === 'object' && target.schema && !deps.schemas[target.schema]) {
      const dep = await api<SchemaDef>(`/api/schemas/${encodeURIComponent(target.schema)}`);
      await preloadDeps(dep, deps, visited);
    }
    if (target.type === 'reference' && target.schema && !deps.options[target.schema]) {
      deps.options[target.schema] = await api<ContentListItem[]>(`/api/content/${encodeURIComponent(target.schema)}`);
    }
  }
}

export function useSchemaDeps(schema: SchemaDef | null): UseSchemaDepsState {
  const [state, setState] = useState<UseSchemaDepsState>({ deps: null, loading: true, error: null });

  useEffect(() => {
    if (!schema) return;
    let cancelled = false;
    setState({ deps: null, loading: true, error: null });

    const deps: SchemaDeps = { schemas: {}, options: {} };
    preloadDeps(schema, deps, new Set())
      .then(() => {
        if (!cancelled) setState({ deps, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ deps: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
    // Keyed on the schema's name, not the object reference, since a fresh
    // schema object arrives on every fetch even when it represents the same schema.
  }, [schema?.name]);

  return state;
}
