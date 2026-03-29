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
import { ChartInput, ChartType, chartCache } from "./types.js";
import { CHART_TYPE_INFO, CHART_SCHEMAS } from "./schemas.js";
import pkg from "../package.json";

// ─── Config ───────────────────────────────────────────────────────────────────

const VERSION: string = pkg.version ?? "1.0.0";

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
// Set TRUST_PROXY=false to disable if running without a trusted proxy in front.
if (process.env.TRUST_PROXY !== "false") {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveBaseUrl(req: Request): string {
  if (BASE_URL) return BASE_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host") as string}`;
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
  const schema = CHART_SCHEMAS[type as ChartType];
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
    const input = req.body as ChartInput & { seriesLabels?: string[] };

    if (!input || typeof input !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object", code: "INVALID_BODY" });
      return;
    }

    const result = generateChart(input);

    // Apply TTL and capacity cap after caching
    scheduleEviction(result.chartId);
    enforceCapacity();

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
  res.end(svg);
});

/**
 * GET /v1/charts/:chartId/png
 */
app.get("/v1/charts/:chartId/png", async (req: Request, res: Response) => {
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

app.listen(PORT, () => {
  console.log(`Charta API v${VERSION} listening on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  GET  /v1/health");
  console.log("  GET  /v1/chart-types");
  console.log("  GET  /v1/chart-types/:type/schema");
  console.log("  POST /v1/charts");
  console.log("  GET  /v1/charts/:chartId/svg");
  console.log("  GET  /v1/charts/:chartId/png");
});

export default app;
