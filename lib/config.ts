import * as fs from 'fs';
import * as path from 'path';
import type { NiceConfig } from '../types/domain';

interface UserConfig {
  schemaRoots?: string[];
  contentRoots?: string[];
  styleRoots?: string[];
  port?: number;
}

// Everything defaults to living under one nice/ folder at the project root
// rather than three separate top-level folders - tidier, and matches what
// a consumer would otherwise end up hand-configuring anyway.
export const DEFAULTS = {
  schemaRoots: ['nice/schemas'],
  contentRoots: ['nice/content'],
  styleRoots: ['nice/styles'],
  port: 6423 // dial-pad spelling of N-I-C-E
};

export function loadConfig(cwd: string = process.cwd()): NiceConfig {
  const configPath = path.join(cwd, 'nice.config.json');
  let userConfig: UserConfig = {};
  if (fs.existsSync(configPath)) {
    userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const schemaRoots = userConfig.schemaRoots || DEFAULTS.schemaRoots;
  const contentRoots = userConfig.contentRoots || DEFAULTS.contentRoots;
  const styleRoots = userConfig.styleRoots || DEFAULTS.styleRoots;

  return {
    cwd,
    port: userConfig.port || DEFAULTS.port,
    schemaRoots: schemaRoots.map((p) => path.resolve(cwd, p)),
    contentRoots: contentRoots.map((p) => path.resolve(cwd, p)),
    defaultContentRoot: path.resolve(cwd, contentRoots[0]),
    styleRoots: styleRoots.map((p) => path.resolve(cwd, p))
  };
}
