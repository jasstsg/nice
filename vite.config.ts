import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import niceApiPlugin from './vite-plugins/nice-api-plugin';
import { loadConfig } from './lib/config';

// This repo's own root isn't a "content project" - nice.config.json (and the
// schemas/content it points at) belongs in demo/, which is. Loading config
// as if demo/ were cwd means `npm run dev` reads (or defaults from) exactly
// what a real consumer running `nice` from inside demo/ would.
const config = loadConfig(path.join(process.cwd(), 'demo'));

export default defineConfig({
  plugins: [niceApiPlugin(config), react()],
  // this repo's old public/ held the pre-React vanilla app - without this,
  // Vite's reserved public/ convention would copy that dead code verbatim
  // into dist/ alongside the real React build output.
  publicDir: false,
  server: {
    port: 5173, // independent of config.port (6423, the production port) - dev and prod never fight over a port
    watch: {
      ignored: [
        '**/.git/**',
        ...config.schemaRoots.map((r) => `${r}/**`),
        ...config.contentRoots.map((r) => `${r}/**`),
        ...config.styleRoots.map((r) => `${r}/**`)
      ]
    }
  }
});
