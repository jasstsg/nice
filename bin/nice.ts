#!/usr/bin/env node
import { loadConfig } from '../lib/config';
import { createServer } from '../lib/server';

const config = loadConfig(process.cwd());
const server = createServer(config);

server.listen(config.port, () => {
  console.log(`nice running at http://localhost:${config.port}`);
  console.log(`  schemas: ${config.schemaRoots.join(', ')}`);
  console.log(`  content: ${config.contentRoots.join(', ')}`);
});
