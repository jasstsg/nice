import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { discoverSchemas, buildSchemaTree, validateSchemaRaw, resolveSchemaFile, isWithin, walkFiles, SCHEMA_EXT } from './schemas';
import { listContent, readContent, saveContent, deleteContent, buildTree } from './content';
import type { NiceConfig, SchemaDef } from '../types/domain';

// This file compiles to build/lib/server.js (see tsconfig.server.json's
// rootDir) - one directory level deeper than the source lives at - so
// DIST_DIR needs an extra ".." to still land on the project root's dist/
// (the Vite frontend build output, which is never nested under build/).
const DIST_DIR = path.join(__dirname, '..', '..', 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', (c) => (chunks += c));
    req.on('end', () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Looks up a schema by name, sending a 404 itself when missing so route
// handlers don't each repeat the same not-found boilerplate.
function requireSchema(config: NiceConfig, name: string, res: http.ServerResponse): SchemaDef | undefined {
  const schema = discoverSchemas(config.schemaRoots).get(name);
  if (!schema) sendJson(res, 404, { error: `Schema "${name}" not found` });
  return schema;
}

function serveStatic(res: http.ServerResponse, pathname: string): void {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(DIST_DIR, rel);
  if (!isWithin(DIST_DIR, filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// All the actual /api/* route matching - only reachable via
// handleApiRequest, which guarantees pathname already starts with "/api/".
async function routeApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: NiceConfig,
  url: URL,
  pathname: string
): Promise<void> {
  if (pathname === '/api/schemas' && req.method === 'GET') {
    const schemas = discoverSchemas(config.schemaRoots);
    sendJson(res, 200, [...schemas.values()].map((s) => ({ name: s.name, label: s.label || s.name })));
    return;
  }

  if (pathname === '/api/tree' && req.method === 'GET') {
    const schemas = discoverSchemas(config.schemaRoots);
    sendJson(res, 200, buildTree(config, schemas));
    return;
  }

  if (pathname === '/api/schema-files' && req.method === 'GET') {
    sendJson(res, 200, buildSchemaTree(config.schemaRoots, config.cwd));
    return;
  }

  if (pathname === '/api/schema-files/content') {
    const relPath = url.searchParams.get('path');

    if (req.method === 'GET') {
      const file = resolveSchemaFile(config.schemaRoots, config.cwd, relPath);
      if (!file || !fs.existsSync(file)) return sendJson(res, 404, { error: 'Schema file not found' });
      return sendJson(res, 200, { path: relPath, raw: fs.readFileSync(file, 'utf8') });
    }

    if (req.method === 'PUT') {
      const file = resolveSchemaFile(config.schemaRoots, config.cwd, relPath);
      if (!file || !fs.existsSync(file)) return sendJson(res, 404, { error: 'Schema file not found' });
      const body = await readBody(req);
      const validation = validateSchemaRaw(body.raw);
      if (!validation.ok) return sendJson(res, 400, { error: validation.error });
      fs.writeFileSync(file, validation.formatted as string, 'utf8');
      return sendJson(res, 200, { path: relPath });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body.path || !body.path.endsWith(SCHEMA_EXT)) {
        return sendJson(res, 400, { error: `Path must end with "${SCHEMA_EXT}"` });
      }
      const file = resolveSchemaFile(config.schemaRoots, config.cwd, body.path);
      if (!file) return sendJson(res, 400, { error: 'Invalid path' });
      if (fs.existsSync(file)) return sendJson(res, 409, { error: 'A schema file already exists at that path' });
      const validation = validateSchemaRaw(body.raw);
      if (!validation.ok) return sendJson(res, 400, { error: validation.error });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, validation.formatted as string, 'utf8');
      return sendJson(res, 201, { path: body.path });
    }

    if (req.method === 'DELETE') {
      const file = resolveSchemaFile(config.schemaRoots, config.cwd, relPath);
      if (!file || !fs.existsSync(file)) return sendJson(res, 404, { error: 'Schema file not found' });
      fs.unlinkSync(file);
      return sendJson(res, 200, { deleted: true });
    }
    return;
  }

  const schemaMatch = pathname.match(/^\/api\/schemas\/([^/]+)$/);
  if (schemaMatch) {
    const schema = requireSchema(config, schemaMatch[1], res);
    if (!schema) return;

    if (req.method === 'GET') {
      sendJson(res, 200, schema);
      return;
    }
  }

  const listMatch = pathname.match(/^\/api\/content\/([^/]+)$/);
  if (listMatch) {
    const schema = requireSchema(config, listMatch[1], res);
    if (!schema) return;

    if (req.method === 'GET') {
      const items = listContent(schema, config).map(({ id, label }) => ({ id, label }));
      sendJson(res, 200, items);
      return;
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      try {
        const result = saveContent(schema, null, body, config, url.searchParams.get('path'));
        sendJson(res, 201, { id: result.id, path: path.relative(config.cwd, result.file) });
      } catch (err) {
        sendJson(res, 400, { error: (err as Error).message });
      }
      return;
    }
  }

  const itemMatch = pathname.match(/^\/api\/content\/([^/]+)\/([^/]+)$/);
  if (itemMatch) {
    const schema = requireSchema(config, itemMatch[1], res);
    if (!schema) return;
    const id = itemMatch[2];

    if (req.method === 'GET') {
      const content = readContent(schema, id, config);
      if (!content) return sendJson(res, 404, { error: 'Content not found' });
      sendJson(res, 200, content);
      return;
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      try {
        const result = saveContent(schema, id, body, config);
        sendJson(res, 200, { id: result.id, path: path.relative(config.cwd, result.file) });
      } catch (err) {
        sendJson(res, 400, { error: (err as Error).message });
      }
      return;
    }
    if (req.method === 'DELETE') {
      const ok = deleteContent(schema, id, config);
      sendJson(res, ok ? 200 : 404, { deleted: ok });
      return;
    }
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Not found' });
  }
}

// Every /api/* pathname is guaranteed a response by routeApi (either a
// matched route or its own trailing 404), so returning true for any /api/
// path is correct by construction - not something that needs per-branch
// bookkeeping. Reused as-is by both the production http.createServer below
// and the Vite dev-server middleware plugin (see vite-plugins/nice-api-plugin.ts).
export async function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, config: NiceConfig): Promise<boolean> {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/api/')) return false;

  try {
    await routeApi(req, res, config, url, pathname);
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: (err as Error).message });
  }
  return true;
}

// Always served at a fixed URL regardless of whether any styleRoots have
// content, so the built index.html can reference it unconditionally - an
// empty response when nothing's found, rather than a 404, means there's
// nothing for a consumer to wire up beyond dropping CSS files in place.
// Reused by both the production server below and the Vite dev plugin, same
// as handleApiRequest.
export function handleCustomCss(req: http.IncomingMessage, res: http.ServerResponse, config: NiceConfig): boolean {
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/custom.css' || req.method !== 'GET') return false;

  const files = config.styleRoots.flatMap((root) => walkFiles(root, (name) => name.endsWith('.css'))).sort();
  const content =
    files.length > 0
      ? files.map((file) => `/* ${path.relative(config.cwd, file)} */\n${fs.readFileSync(file, 'utf8')}`).join('\n')
      : '/* no CSS files found in the configured styleRoots */\n';

  res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
  res.end(content);
  return true;
}

export function createServer(config: NiceConfig): http.Server {
  return http.createServer(async (req, res) => {
    if (await handleApiRequest(req, res, config)) return;
    if (handleCustomCss(req, res, config)) return;
    const url = new URL(req.url || '/', 'http://localhost');
    serveStatic(res, decodeURIComponent(url.pathname));
  });
}
