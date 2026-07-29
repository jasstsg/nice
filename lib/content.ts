import * as fs from 'fs';
import * as path from 'path';
import { walkJsonFiles, walkDirTree, resolveWithinAnyRoot } from './schemas';
import type { SchemaDef, NiceConfig, ContentRecord, ContentTreeFileNode, ContentTreeRoot } from '../types/domain';

// Strips the ".json" suffix so a fallback id (used only when a file is
// missing its own "$id") comes from a plain filename.
function stripJsonExt(filename: string): string {
  return filename.replace(/\.json$/, '');
}

export function slugify(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Used only to seed a new item's auto-generated filename slug - a
// reasonable starting point for a filename, distinct from the item's
// display label (which is just its id - see listContent/buildTree below).
function firstStringFieldValue(schema: SchemaDef, data: Record<string, unknown>): unknown {
  const field = (schema.fields || []).find((f) => f.type === 'string');
  return field ? data[field.name] : undefined;
}

// Confines an explicit, user-chosen save path to somewhere the app can
// still find it again later - a path outside every configured contentRoot
// would never show up in listContent/buildTree on the next request.
function resolveExplicitContentPath(config: NiceConfig, explicitPath: string): string | null {
  return resolveWithinAnyRoot(config.contentRoots, config.cwd, explicitPath);
}

interface ContentListEntry {
  id: string;
  label: string;
  file: string;
}

// Content files self-identify via "$niceSchema" rather than relying on
// which folder they live in, so they can be moved (e.g. next to a Next.js
// page) without breaking discovery. This scans every configured content root.
export function listContent(schema: SchemaDef, config: NiceConfig): ContentListEntry[] {
  const items: ContentListEntry[] = [];
  for (const root of config.contentRoots) {
    for (const file of walkJsonFiles(root)) {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      if (data.$niceSchema !== schema.name) continue;
      const id = (data.$id as string) || stripJsonExt(path.basename(file));
      items.push({ id, label: id, file });
    }
  }
  return items;
}

function findContentFile(schema: SchemaDef, id: string, config: NiceConfig): string | null {
  const match = listContent(schema, config).find((item) => item.id === id);
  return match ? match.file : null;
}

export function readContent(schema: SchemaDef, id: string, config: NiceConfig): ContentRecord | null {
  const file = findContentFile(schema, id, config);
  if (!file) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { $niceSchema, $id, ...rest } = raw;
  return { id: $id || id, path: path.relative(config.cwd, file), data: rest };
}

function generateId(schema: SchemaDef, data: Record<string, unknown>, existingIds: Set<string>): string {
  const base = slugify(firstStringFieldValue(schema, data)) || `item-${Date.now().toString(36)}`;
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export interface SaveContentResult {
  id: string;
  file: string;
}

// id === null means "create new". Ids are assigned once at creation and
// never change on update, even if the field they were slugified from does -
// reference fields elsewhere point at this id, so it has to stay stable.
//
// explicitPath (create only) lets a single item be pinned to an exact file -
// e.g. "content/resume.json" so an existing `import resume from` keeps
// working - without schemas needing any location config of their own.
export function saveContent(
  schema: SchemaDef,
  id: string | null,
  data: Record<string, unknown>,
  config: NiceConfig,
  explicitPath?: string | null
): SaveContentResult {
  let file: string;
  let finalId: string;

  if (id) {
    const existing = findContentFile(schema, id, config);
    if (!existing) throw new Error(`Content "${id}" not found for schema "${schema.name}"`);
    file = existing;
    finalId = id;
  } else if (explicitPath) {
    if (!explicitPath.toLowerCase().endsWith('.json')) {
      throw new Error('Path must end with .json');
    }
    const resolved = resolveExplicitContentPath(config, explicitPath);
    if (!resolved) {
      const roots = config.contentRoots.map((r) => path.relative(config.cwd, r)).join(', ');
      throw new Error(`Path must be inside a configured content root (${roots})`);
    }
    if (fs.existsSync(resolved)) {
      throw new Error('A file already exists at that path - open it from the content tree to edit it instead.');
    }
    file = resolved;
    finalId = stripJsonExt(path.basename(file));
  } else {
    const existingIds = new Set(listContent(schema, config).map((i) => i.id));
    finalId = generateId(schema, data, existingIds);
    file = path.join(config.defaultContentRoot, schema.name, `${finalId}.json`);
  }

  ensureDir(path.dirname(file));
  const payload = { $niceSchema: schema.name, $id: finalId, ...data };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { id: finalId, file };
}

export function deleteContent(schema: SchemaDef, id: string, config: NiceConfig): boolean {
  const file = findContentFile(schema, id, config);
  if (!file) return false;
  fs.unlinkSync(file);
  return true;
}

// Mirrors the physical folder structure under each content root, tagging
// each .json file with the $niceSchema/$id it self-reports so the UI can
// browse by location instead of only by schema.
export function buildTree(config: NiceConfig, schemas: Map<string, SchemaDef>): ContentTreeRoot[] {
  return config.contentRoots.map((root) => ({
    root,
    name: path.basename(root),
    children: walkDirTree<ContentTreeFileNode>(
      root,
      (name) => name.endsWith('.json'),
      (full, rel, name) => {
        const node: ContentTreeFileNode = {
          type: 'file',
          name,
          path: rel,
          known: false,
          schema: null,
          id: null,
          label: name
        };
        try {
          const data = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (data.$niceSchema) {
            node.schema = data.$niceSchema;
            node.id = data.$id || stripJsonExt(name);
            node.known = schemas.has(data.$niceSchema);
            node.label = node.id as string;
          }
        } catch {
          node.label = `${name} (invalid JSON)`;
        }
        return node;
      }
    )
  }));
}
