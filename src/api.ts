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
 *   SUPABASE_URL              Supabase project URL (required for API key auth)
 *   SUPABASE_SERVICE_ROLE_KEY Supabase service-role key (required for API key auth)
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { generateChart } from "./charts/index.js";
import { ChartInput, ChartType, CHART_TYPES, chartCache } from "./types.js";
import { CHART_TYPE_INFO, CHART_SCHEMAS } from "./schemas.js";
import { z } from "zod";
// Requires "resolveJsonModule": true in tsconfig.json (already set)
import pkg from "../package.json";

// ─── Config ───────────────────────────────────────────────────────────────────

const VERSION: string = pkg.version;

const PORT = process.env.PORT ?? 3000;
const BASE_URL = process.env.BASE_URL; // optional explicit base URL

// CORS origins: comma-separated list, "*" for all, or unset for same-origin only.
// Wildcard must be an explicit opt-in — the default is restrictive (no cross-origin).
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN;
const corsOrigin: string | string[] | boolean =
  CORS_ORIGIN_ENV === undefined
    ? false
    : CORS_ORIGIN_ENV === "*"
      ? "*"
      : CORS_ORIGIN_ENV.split(",").map((s) => s.trim());

// REST-specific TTL eviction (cap enforcement is handled by generateChart → enforceCapacity)
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function scheduleEviction(chartId: string): void {
  setTimeout(() => {
    chartCache.delete(chartId);
  }, CACHE_TTL_MS).unref();
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();

// Trust reverse proxy so req.protocol reflects X-Forwarded-Proto.
// Enable with TRUST_PROXY=1 (or "true") for deployments behind nginx/ALB/Cloudflare.
// Disabled by default to be safe for bare deployments.
// In production, prefer setting BASE_URL to avoid relying on req.protocol entirely.
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "2mb" }));

// Rate limiting: 60 chart-generation requests per minute per IP
const chartGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});

// ─── API Key Authentication ──────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Middleware that validates an API key via Supabase and decrements one credit.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
 * Returns 401 for missing/invalid keys, 429 when daily limit is reached.
 */
async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === "production") {
      // Fatal in production — missing env vars means the endpoint is completely open
      console.error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production");
      process.exit(1);
    }
    // Local dev: warn loudly and allow passthrough
    console.warn("⚠️  API key auth disabled — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set");
    next();
    return;
  }

  const authHeader = req.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or malformed Authorization header. Expected: Bearer <api_key>",
      code: "AUTH_REQUIRED",
    });
    return;
  }

  const apiKey = authHeader.slice(7);
  if (apiKey.length === 0) {
    res.status(401).json({
      error: "API key must not be empty",
      code: "AUTH_REQUIRED",
    });
    return;
  }

  // 5-second timeout on Supabase call — prevents connection pool exhaustion under load
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_credits_by_api_key`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_api_key: apiKey }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Supabase RPC error: ${response.status} ${response.statusText}`);
      res.status(502).json({
        error: "Authentication service error",
        code: "AUTH_SERVICE_ERROR",
      });
      return;
    }

    const result = await response.json() as {
      success: boolean;
      credits_remaining?: number;
      plan?: string;
      email?: string;
      error?: string;
    };

    if (!result.success) {
      // IMPORTANT: "Daily limit reached" must exactly match the string returned by
      // the Supabase `decrement_credits_by_api_key` RPC function. If that string
      // changes, this check will silently fall through to 401 instead of 429.
      if (result.error === "Daily limit reached") {
        res.status(429).json({
          error: "Daily credit limit reached. Please upgrade your plan or try again tomorrow.",
          code: "CREDITS_EXHAUSTED",
        });
      } else {
        res.status(401).json({
          error: "Invalid API key",
          code: "INVALID_API_KEY",
        });
      }
      return;
    }

    (req as any).authContext = {
      creditsRemaining: result.credits_remaining,
      plan: result.plan,
      email: result.email,
    };

    next();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error("API key auth timed out after 5s");
      res.status(503).json({
        error: "Authentication service timed out",
        code: "AUTH_TIMEOUT",
      });
    } else {
      console.error("API key auth error:", err instanceof Error ? err.message : "unknown error");
      res.status(502).json({
        error: "Authentication service unavailable",
        code: "AUTH_SERVICE_ERROR",
      });
    }
  }
}

// Rate limiting for PNG endpoint: stricter than chart gen because PNG conversion
// via sharp is more CPU-intensive than SVG string generation
const pngLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});

// ─── Validation ──────────────────────────────────────────────────────────────

// Derive from CHART_TYPES in types.ts — avoids drift if new types are added
// ChartStyleSchema mirrors ChartStyle in types.ts — update both together
const ChartStyleSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  showGrid: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  showValues: z.boolean().optional(),
}).optional();
// Note: if ChartStyle in types.ts gains new fields, add them here too.

// Compile-time check: if ChartStyle gains a field not in ChartStyleSchema,
// this line will produce a type error, forcing the schema to be updated.
// This prevents accidental stripping of new style properties.
import { ChartStyle } from "./types.js";
type _AssertSchemaCoversStyle = z.infer<NonNullable<typeof ChartStyleSchema>> extends ChartStyle ? true : never;
const _: _AssertSchemaCoversStyle = true;

const ChartRequestSchema = z.object({
  type: z.enum(CHART_TYPES, {
    errorMap: () => ({ message: `type must be one of: ${CHART_TYPES.join(", ")}` }),
  }),
  data: z.array(z.record(z.unknown()).refine(
    (obj): obj is { label: string } => typeof obj["label"] === "string" && obj["label"].length <= 200,
    { message: 'each data item must have a string "label" field (max 200 chars)' }
  )).min(1, "data must have at least one item").max(500, "data must have at most 500 items"),
  title: z.string().max(500).optional(),
  xLabel: z.string().max(200).optional(),
  yLabel: z.string().max(200).optional(),
  seriesLabels: z.array(z.string().max(200)).max(50).optional(),
  style: ChartStyleSchema,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the base URL for resource links.
 * Uses BASE_URL env var when set (required for production).
 * Without BASE_URL in production, falls back to localhost to prevent
 * host-header injection. In non-production, uses the sanitized Host header
 * for local development convenience.
 */
function resolveBaseUrl(req: Request): string {
  if (BASE_URL) return BASE_URL.replace(/\/$/, "");
  // In production, refuse to trust Host header — use safe fallback
  if (process.env.NODE_ENV === "production") {
    return `http://localhost:${PORT}`;
  }
  // Dev only: sanitize the host header for local convenience
  const rawHost = (req.get("host") as string | undefined) ?? "localhost";
  const safeHost = rawHost.replace(/[^a-zA-Z0-9.\-:[\]]/g, "").slice(0, 253);
  return `${req.protocol}://${safeHost}`;
}

/** Sanitize a user-supplied id for safe inclusion in error messages. */
function sanitizeId(id: string): string {
  return id.replace(/[^\w-]/g, "").slice(0, 64);
}

/**
 * Strip dangerous elements from SVG content before serving.
 * Removes <script>, event handlers (onload, onclick, etc.), and <foreignObject>
 * to prevent stored XSS even if chart generators interpolate user strings unsafely.
 *
 * NOTE: Regex-based sanitization is best-effort defense-in-depth.
 * Primary protection comes from CSP headers and Content-Disposition: attachment.
 * For higher assurance, consider a proper XML parser (e.g. DOMPurify in a browser
 * context, or a server-side XML sanitizer). Encoding tricks or multi-line attribute
 * splits could theoretically bypass regex matching.
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
}

// ─── Chart Request Validation Middleware ─────────────────────────────────────

/**
 * Validates the chart request body before auth runs, so credits are not
 * consumed for malformed requests.
 */
function validateChartRequest(req: Request, res: Response, next: NextFunction): void {
  if (Array.isArray(req.body) || typeof req.body !== "object" || req.body === null) {
    res.status(400).json({
      error: "Request body must be a JSON object",
      code: "INVALID_BODY",
    });
    return;
  }
  const parsed = ChartRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => `${e.path.join(".") || "body"}: ${e.message}`);
    res.status(400).json({
      error: messages.join("; "),
      code: "INVALID_BODY",
    });
    return;
  }
  (req as any).validatedChart = parsed.data;
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /v1/health
 */
app.get("/v1/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: VERSION });
});

/**
 * GET /v1/chart-types
 */
app.get("/v1/chart-types", (_req: Request, res: Response) => {
  res.json({ chartTypes: CHART_TYPE_INFO });
});

/**
 * GET /v1/chart-types/:type/schema
 */
app.get("/v1/chart-types/:type/schema", (req: Request, res: Response) => {
  const type = req.params["type"] as string;
  // Use hasOwnProperty to prevent prototype-chain lookups (e.g. "constructor", "__proto__")
  const schema = Object.prototype.hasOwnProperty.call(CHART_SCHEMAS, type)
    ? CHART_SCHEMAS[type as ChartType]
    : undefined;
  if (!schema) {
    res.status(404).json({
      error: `Unknown chart type: "${type}"`,
      code: "UNKNOWN_CHART_TYPE",
      supported: CHART_TYPE_INFO.map((c) => c.type),
    });
    return;
  }
  res.json({ type, schema });
});

/**
 * POST /v1/charts
 * Generate a chart → { chartId, type, svg, svgUrl, pngUrl }
 */
app.post("/v1/charts", chartGenLimiter, validateChartRequest, apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = (req as any).validatedChart as ChartInput & { seriesLabels?: string[] };
    const result = generateChart(input);

    // generateChart() enforces cache capacity before insertion.
    // scheduleEviction() sets a REST-specific TTL on the newly generated chart.
    scheduleEviction(result.chartId);

    const base = resolveBaseUrl(req);

    res.status(201).json({
      chartId: result.chartId,
      type: result.type,
      svg: sanitizeSvg(result.svg),
      svgUrl: `${base}/v1/charts/${result.chartId}/svg`,
      pngUrl: `${base}/v1/charts/${result.chartId}/png`,
    });
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * GET /v1/charts/:chartId/svg
 */
app.get("/v1/charts/:chartId/svg", (req: Request, res: Response) => {
  const chartId = req.params["chartId"] as string;
  const svg = chartCache.get(chartId);
  if (!svg) {
    res.status(404).json({ error: `Chart not found: ${sanitizeId(chartId)}`, code: "CHART_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  // Prevent script execution if SVG is rendered directly in a browser
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
  // Suggest download to avoid browser rendering SVG directly (defence-in-depth)
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeId(chartId)}.svg"`);
  res.end(sanitizeSvg(svg));
});

/**
 * GET /v1/charts/:chartId/png
 */
app.get("/v1/charts/:chartId/png", pngLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chartId = req.params["chartId"] as string;
    const svg = chartCache.get(chartId);
    if (!svg) {
      res.status(404).json({ error: `Chart not found: ${sanitizeId(chartId)}`, code: "CHART_NOT_FOUND" });
      return;
    }

    const sharp = (await import("sharp")).default;
    const safeSvg = sanitizeSvg(svg);
    const png = await sharp(Buffer.from(safeSvg), { density: 144 }).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(png);
  } catch (err: unknown) {
    // Forward to the main error handler
    next(err);
  }
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

// Express requires 4-argument signature to identify error handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  // Differentiate between user errors (e.g., bad input from generateChart) and true server errors
  if (err.message.includes("Invalid")) { // Heuristic for validation errors
    res.status(400).json({ error: err.message, code: "CHART_GENERATION_FAILED" });
  } else {
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

// Auto-start only when executed directly (node dist/api.js) or when START_SERVER=1.
// When imported as a module (e.g. for testing individual routes), the server does
// NOT auto-start — call app.listen() manually or set START_SERVER=1 before require.
if (require.main === module || process.env.START_SERVER === "1") {
  const httpServer = app.listen(PORT, () => {
    console.log(`Charta API v${VERSION} listening on http://localhost:${PORT}`);
    if (!BASE_URL && process.env.NODE_ENV === "production") {
      console.warn(
        "⚠️  BASE_URL is not set. In production, svgUrl/pngUrl will use localhost as fallback. " +
        "Set BASE_URL to the public hostname for correct resource URLs."
      );
    }
    if (!CORS_ORIGIN_ENV) {
      console.log("CORS: disabled (same-origin only). Set CORS_ORIGIN to allow cross-origin requests.");
    }
    console.log("Endpoints:");
    console.log("  GET  /v1/health");
    console.log("  GET  /v1/chart-types");
    console.log("  GET  /v1/chart-types/:type/schema");
    console.log("  POST /v1/charts");
    console.log("  GET  /v1/charts/:chartId/svg");
    console.log("  GET  /v1/charts/:chartId/png");
  });

  // Graceful shutdown on SIGTERM (container / process manager signals)
  process.on("SIGTERM", () => {
    console.log("SIGTERM received — shutting down gracefully");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

export default app;
