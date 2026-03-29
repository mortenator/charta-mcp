#!/usr/bin/env node
/**
 * Charta REST API v1
 * Express HTTP server exposing chart generation over REST.
 * Run: node dist/api.js (or npm run api)
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { generateChart } from "./charts/index.js";
import { ChartInput, ChartType, chartCache } from "./types.js";
import { CHART_TYPE_INFO, CHART_SCHEMAS } from "./schemas.js";

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "1.0.0";

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /v1/health
 * Simple healthcheck.
 */
app.get("/v1/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: VERSION });
});

/**
 * GET /v1/chart-types
 * List all supported chart types with descriptions and examples.
 */
app.get("/v1/chart-types", (_req: Request, res: Response) => {
  res.json({ chartTypes: CHART_TYPE_INFO });
});

/**
 * GET /v1/chart-types/:type/schema
 * Get JSON schema for a specific chart type.
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
 * Generate a chart and return SVG + PNG URL.
 *
 * Body: { type, data, title?, xLabel?, yLabel?, seriesLabels?, style? }
 * Response: { chartId, type, svg, pngUrl }
 */
app.post("/v1/charts", (req: Request, res: Response) => {
  try {
    const input = req.body as ChartInput & { seriesLabels?: string[] };

    if (!input || typeof input !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object", code: "INVALID_BODY" });
      return;
    }

    const result = generateChart(input);
    const host = req.get("host") ?? `localhost:${PORT}`;
    const proto = req.protocol ?? "http";

    res.status(201).json({
      chartId: result.chartId,
      type: result.type,
      svg: result.svg,
      svgUrl: `${proto}://${host}/v1/charts/${result.chartId}/svg`,
      pngUrl: `${proto}://${host}/v1/charts/${result.chartId}/png`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message, code: "CHART_GENERATION_FAILED" });
  }
});

/**
 * GET /v1/charts/:chartId/svg
 * Return cached SVG for a chart.
 */
app.get("/v1/charts/:chartId/svg", (req: Request, res: Response) => {
  const chartId = req.params["chartId"] as string;
  const svg = chartCache.get(chartId);
  if (!svg) {
    res.status(404).json({ error: `Chart not found: ${chartId}`, code: "CHART_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(svg);
});

/**
 * GET /v1/charts/:chartId/png
 * Return cached chart as PNG binary (requires sharp).
 */
app.get("/v1/charts/:chartId/png", async (req: Request, res: Response) => {
  const chartId = req.params["chartId"] as string;
  const svg = chartCache.get(chartId);
  if (!svg) {
    res.status(404).json({ error: `Chart not found: ${chartId}`, code: "CHART_NOT_FOUND" });
    return;
  }

  try {
    // Dynamically import sharp so the server still starts if sharp is unavailable
    const sharp = (await import("sharp")).default;
    const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(png);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({
      error: `PNG conversion failed: ${message}`,
      code: "PNG_CONVERSION_FAILED",
    });
  }
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

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
