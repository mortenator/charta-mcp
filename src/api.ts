#!/usr/bin/env node
/**
 * Charta REST API v1
 * Express HTTP server exposing chart generation over REST.
 * Run: node dist/api.js (or npm run api)
 *
 * Env vars:
 *   PORT=3000       HTTP port to listen on
 *   BASE_URL        Public base URL for svgUrl/pngUrl (e.g. https://api.getcharta.ai)
 *   CORS_ORIGIN     Allowed CORS origins (comma-separated, or * for all). Default: *
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

// CORS origins: comma-separated list or * for all
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN ?? "*";
const corsOrigin: string | string[] | boolean =
  CORS_ORIGIN_ENV === "*" ? "*" : CORS_ORIGIN_ENV.split(",").map((s) => s.trim());

// Simple in-memory cache TTL + size cap
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_ENTRIES = 500;

function scheduleEviction(chartId: string): void {
  setTimeout(() => {
    chartCache.delete(chartId);
  }, CACHE_TTL_MS).unref();
}

function enforceCapacity(): void {
  if (chartCache.size > CACHE_MAX_ENTRIES) {
    // Delete the oldest entry (Maps iterate insertion order)
    const firstKey = chartCache.keys().next().value;
    if (firstKey !== undefined) {
      chartCache.delete(firstKey);
    }
  }
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

const ChartRequestSchema = z.object({
  type: z.enum(CHART_TYPES, {
    errorMap: () => ({ message: `type must be one of: ${CHART_TYPES.join(", ")}` }),
  }),
  data: z.array(z.record(z.unknown())).min(1, "data must have at least one item"),
  title: z.string().optional(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  seriesLabels: z.array(z.string()).optional(),
  style: ChartStyleSchema,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the base URL for resource links.
 * Uses BASE_URL env var when set (preferred for production).
 * Without BASE_URL, uses req.protocol + Host header — this relies on
 * `trust proxy` being correctly configured; set BASE_URL to eliminate
 * host-header injection risk entirely.
 */
function resolveBaseUrl(req: Request): string {
  if (BASE_URL) return BASE_URL.replace(/\/$/, "");
  // Sanitize the host header: allow only hostname:port characters
  const rawHost = (req.get("host") as string | undefined) ?? "localhost";
  const safeHost = rawHost.replace(/[^a-zA-Z0-9.\-:[\]]/g, "").slice(0, 253);
  return `${req.protocol}://${safeHost}`;
}

/** Sanitize a user-supplied id for safe inclusion in error messages. */
function sanitizeId(id: string): string {
  return id.replace(/[^\w-]/g, "").slice(0, 64);
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
app.post("/v1/charts", chartGenLimiter, (req: Request, res: Response) => {
  try {
    // Validate request body with zod schema before passing to chart engine
    const parsed = ChartRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e) => `${e.path.join(".") || "body"}: ${e.message}`);
      res.status(400).json({
        error: messages.join("; "),
        code: "INVALID_BODY",
      });
      return;
    }

    const input = parsed.data as unknown as ChartInput & { seriesLabels?: string[] };
    const result = generateChart(input);

    // generateChart() has already stored the chart in chartCache.
    // enforceCapacity() evicts the OLDEST entry (Map insertion order), not the new one.
    // scheduleEviction() sets a TTL on the newly generated chart.
    enforceCapacity();
    scheduleEviction(result.chartId);

    const base = resolveBaseUrl(req);

    res.status(201).json({
      chartId: result.chartId,
      type: result.type,
      svg: result.svg,
      svgUrl: `${base}/v1/charts/${result.chartId}/svg`,
      pngUrl: `${base}/v1/charts/${result.chartId}/png`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message, code: "CHART_GENERATION_FAILED" });
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
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Suggest download to avoid browser rendering SVG directly (defence-in-depth)
  res.setHeader("Content-Disposition", `attachment; filename="${sanitizeId(chartId)}.svg"`);
  res.end(svg);
});

/**
 * GET /v1/charts/:chartId/png
 */
app.get("/v1/charts/:chartId/png", pngLimiter, async (req: Request, res: Response) => {
  const chartId = req.params["chartId"] as string;
  const svg = chartCache.get(chartId);
  if (!svg) {
    res.status(404).json({ error: `Chart not found: ${sanitizeId(chartId)}`, code: "CHART_NOT_FOUND" });
    return;
  }

  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(png);
  } catch (_err: unknown) {
    // Don't expose internal sharp/native error details to the client
    res.status(503).json({
      error: "PNG conversion failed. The chart may be invalid or the PNG renderer is unavailable.",
      code: "PNG_CONVERSION_FAILED",
    });
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
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const httpServer = app.listen(PORT, () => {
  console.log(`Charta API v${VERSION} listening on http://localhost:${PORT}`);
  if (!BASE_URL && process.env.NODE_ENV === "production") {
    console.warn(
      "⚠️  BASE_URL is not set. svgUrl/pngUrl in responses are constructed from the " +
      "Host request header. Set BASE_URL to eliminate host-header injection risk."
    );
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

export default app;
