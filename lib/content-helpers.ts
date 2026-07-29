import * as fs from 'fs';
import * as path from 'path';

// The one public, framework-agnostic way to read content `nice` saved.
// Plain fs/path, nothing that pulls in React/Vite/TypeScript at runtime,
// and it reads the real JSON fresh on every call - there is never a
// generated or cached copy of your content to go stale.
//
// `reference` fields are stored as self-describing markers -
// { "$niceSchema": "<schema>", "$id": "<id>" } - so resolving one back into
// the full object never needs to consult the schema that produced it: this
// just walks the JSON looking for that shape and inlines whatever it finds
// by searching `contentRoots` for a matching file.
//
// Pass a file to read a single item (a pinned singleton, or one specific
// collection item); pass a directory to read every item in a collection.
export function readNiceContent<T = unknown>(target: string, contentRoots: string | string[] = 'nice/content'): T {
  const roots = Array.isArray(contentRoots) ? contentRoots : [contentRoots];
  const cache = new Map<string, unknown>();
  const resolving = new Set<string>();

  function readJson(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function isReferenceMarker(obj: Record<string, unknown>): obj is { $niceSchema: string; $id: string } {
    const keys = Object.keys(obj);
    return keys.length === 2 && typeof obj.$niceSchema === 'string' && typeof obj.$id === 'string';
  }

  function findContentFile(schema: string, id: string): string | null {
    function walk(dir: string): string | null {
      if (!fs.existsSync(dir)) return null;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = walk(full);
          if (found) return found;
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const data = readJson(full);
            if (data.$niceSchema === schema && data.$id === id) return full;
          } catch {
            // not valid JSON - not one of ours, skip it
          }
        }
      }
      return null;
    }
    for (const root of roots) {
      const found = walk(root);
      if (found) return found;
    }
    return null;
  }

  function resolveReference(schema: string, id: string): unknown {
    const key = `${schema}/${id}`;
    if (cache.has(key)) return cache.get(key);
    if (resolving.has(key)) {
      throw new Error(`nice: circular reference detected while resolving ${key}`);
    }
    const file = findContentFile(schema, id);
    if (!file) throw new Error(`nice: no content found for ${key}`);

    resolving.add(key);
    const resolved = resolveValue(readJson(file));
    resolving.delete(key);
    cache.set(key, resolved);
    return resolved;
  }

  function resolveValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (isReferenceMarker(obj)) return resolveReference(obj.$niceSchema, obj.$id);

      // A real file's own top level (or a resolved reference target) -
      // strip $niceSchema (meaningless outside of nice) and rename $id to
      // a plain "id" (useful for React keys); a no-op for plain nested
      // objects, which never carry these keys in the first place.
      const { $niceSchema, $id, ...rest } = obj;
      const out: Record<string, unknown> = $id !== undefined ? { id: $id } : {};
      for (const [k, v] of Object.entries(rest)) out[k] = resolveValue(v);
      return out;
    }
    return value;
  }

  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    return fs
      .readdirSync(target)
      .filter((f) => f.endsWith('.json'))
      .map((f) => resolveValue(readJson(path.join(target, f)))) as T;
  }
  return resolveValue(readJson(target)) as T;
}
