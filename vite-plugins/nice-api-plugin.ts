import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { handleApiRequest, handleCustomCss } from '../lib/server';
import type { NiceConfig } from '../types/domain';

export default function niceApiPlugin(config: NiceConfig): Plugin {
  return {
    name: 'nice-api',
    configureServer(server: ViteDevServer) {
      // Do NOT return a function here. Vite's SPA-fallback middleware
      // serves index.html for any extension-less GET (which /api/tree,
      // /api/schemas, etc. all are) - if our middleware registered AFTER
      // Vite's internal stack, every API call would be silently answered
      // with the React app's HTML instead of JSON. No return value means
      // this registers before Vite's internal middleware, which is
      // required here.
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        try {
          if (await handleApiRequest(req, res, config)) return;
          if (handleCustomCss(req, res, config)) return;
          next();
        } catch (err) {
          // connect does not await async middleware - an uncaught
          // rejection here means the request just hangs with no response
          // ever sent, not a visible 500. This catch is load-bearing.
          next(err);
        }
      });
    }
  };
}
