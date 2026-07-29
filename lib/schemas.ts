import * as fs from 'fs';
import * as path from 'path';
import type { SchemaDef, TreeItem, TreeDirNode, SchemaTreeFileNode, SchemaTreeRoot } from '../types/domain';

export const SCHEMA_EXT = '.nice-schema.json';

export function walkFiles(root: string, filter?: (name: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(root)) return results;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, filter));
    } else if (entry.isFile() && (!filter || filter(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

export function walkJsonFiles(root: string): string[] {
  return walkFiles(root, (name) => name.endsWith('.json'));
}

// Generic recursive directory -> tree builder, shared by the content tree
// and the schema tree so the recursion/sorting logic (the only part that's
// actually identical) lives in one place. Only `buildFileNode` differs
// between the two callers.
export function walkDirTree<T>(
  root: string,
  fileFilter: (name: string) => boolean,
  buildFileNode: (full: string, rel: string, name: string) => T,
  initialRelBase: string = ''
): TreeItem<T>[] {
  function walk(dir: string, relBase: string): TreeItem<T>[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    const nodes: TreeItem<T>[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const dirNode: TreeDirNode<T> = { type: 'dir', name: entry.name, path: rel, children: walk(full, rel) };
        nodes.push(dirNode);
        continue;
      }
      if (!entry.isFile() || !fileFilter(entry.name)) continue;
      nodes.push(buildFileNode(full, rel, entry.name));
    }
    return nodes;
  }
  return walk(root, initialRelBase);
}

// True if the (already absolute) path `full` is root itself or somewhere
// beneath it.
export function isWithin(root: string, full: string): boolean {
  const base = path.resolve(root);
  return full === base || full.startsWith(base + path.sep);
}

// Resolves relPath against cwd (not against any one root) and confirms the
// result lands inside at least one of `roots` - shared by schema-file and
// content-file path resolution so a caller-supplied path is always
// unambiguous even when multiple roots are configured.
export function resolveWithinAnyRoot(roots: string[], cwd: string, relPath: string | null): string | null {
  if (!relPath) return null;
  const full = path.resolve(cwd, relPath);
  const withinAnyRoot = roots.some((root) => isWithin(root, full));
  return withinAnyRoot ? full : null;
}

export function resolveSchemaFile(schemaRoots: string[], cwd: string, relPath: string | null): string | null {
  return resolveWithinAnyRoot(schemaRoots, cwd, relPath);
}

// Only *.nice-schema.json files are treated as schemas, so a schemaRoot can
// safely hold other JSON (notes, fixtures) without it being mistaken for a
// schema definition.
export function discoverSchemas(schemaRoots: string[]): Map<string, SchemaDef> {
  const schemas = new Map<string, SchemaDef>();
  for (const schemaRoot of schemaRoots) {
    for (const file of walkFiles(schemaRoot, (name) => name.endsWith(SCHEMA_EXT))) {
      let def: SchemaDef;
      try {
        def = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        console.warn(`Skipping invalid schema JSON at ${file}: ${(err as Error).message}`);
        continue;
      }
      if (!def.name || !Array.isArray(def.fields)) {
        console.warn(`Skipping ${file}: schema must have a "name" and a "fields" array`);
        continue;
      }
      if (schemas.has(def.name)) {
        console.warn(`Duplicate schema name "${def.name}" at ${file}, overwriting previous definition`);
      }
      schemas.set(def.name, def);
    }
  }
  return schemas;
}

// Mirrors the physical folder structure under each schemaRoot for the
// Schema editor's file browser - every matched file already IS a schema
// (unlike content, there's no separate "is this a known type" check to
// make). Node paths come out relative to cwd (not to whichever root they're
// under) so they stay a valid, unambiguous "?path=" value across multiple
// configured schemaRoots.
export function buildSchemaTree(schemaRoots: string[], cwd: string): SchemaTreeRoot[] {
  return schemaRoots.map((root) => ({
    root,
    name: path.basename(root),
    children: walkDirTree<SchemaTreeFileNode>(
      root,
      (name) => name.endsWith(SCHEMA_EXT),
      (full, rel, name) => {
        const node: SchemaTreeFileNode = { type: 'file', name, path: rel, schemaName: null, label: name, valid: false };
        try {
          const def = JSON.parse(fs.readFileSync(full, 'utf8'));
          node.schemaName = def.name || null;
          node.label = def.label || def.name || name;
          node.valid = !!(def.name && Array.isArray(def.fields));
        } catch {
          node.label = `${name} (invalid JSON)`;
        }
        return node;
      },
      path.relative(cwd, root).split(path.sep).join('/')
    )
  }));
}

export interface SchemaValidationResult {
  ok: boolean;
  error?: string;
  formatted?: string;
}

export function validateSchemaRaw(raw: string): SchemaValidationResult {
  let def: SchemaDef;
  try {
    def = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  if (!def.name || typeof def.name !== 'string') {
    return { ok: false, error: 'Schema must have a string "name"' };
  }
  if (!Array.isArray(def.fields)) {
    return { ok: false, error: 'Schema must have a "fields" array' };
  }
  return { ok: true, formatted: JSON.stringify(def, null, 2) + '\n' };
}
