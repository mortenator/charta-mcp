#!/usr/bin/env node
/**
 * Charta REST API v1
 * Express HTTP server exposing chart generation over REST.
 * Run: node dist/api.js (or npm run api)
 *
 * Env vars:
 *   PORT=3000       HTTP port to listen on
 *   BASE_URL        Public base URL for svgUrl/pngUrl (e.g. https://api.getcharta.ai)
 *   CORS_ORIGIN     Allowed CORS origins (comma-separated, or * for all). Default: disabled (same-origin)
 */
declare const app: import("express-serve-static-core").Express;
export default app;
//# sourceMappingURL=api.d.ts.map