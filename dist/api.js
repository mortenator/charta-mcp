#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const index_js_1 = require("./charts/index.js");
const types_js_1 = require("./types.js");
const schemas_js_1 = require("./schemas.js");
const zod_1 = require("zod");
// Requires "resolveJsonModule": true in tsconfig.json (already set)
const package_json_1 = __importDefault(require("../package.json"));
// ─── Config ───────────────────────────────────────────────────────────────────
const VERSION = package_json_1.default.version;
const PORT = process.env.PORT ?? 3000;
const BASE_URL = process.env.BASE_URL; // optional explicit base URL
// CORS origins: comma-separated list, "*" for all, or unset for same-origin only.
// Wildcard must be an explicit opt-in — the default is restrictive (no cross-origin).
const CORS_ORIGIN_ENV = process.env.CORS_ORIGIN;
const corsOrigin = CORS_ORIGIN_ENV === undefined
    ? false
    : CORS_ORIGIN_ENV === "*"
        ? "*"
        : CORS_ORIGIN_ENV.split(",").map((s) => s.trim());
// REST-specific TTL eviction (cap enforcement is handled by generateChart → enforceCapacity)
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
function scheduleEviction(chartId) {
    setTimeout(() => {
        types_js_1.chartCache.delete(chartId);
    }, CACHE_TTL_MS).unref();
}
// ─── App ─────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
// Trust reverse proxy so req.protocol reflects X-Forwarded-Proto.
// Enable with TRUST_PROXY=1 (or "true") for deployments behind nginx/ALB/Cloudflare.
// Disabled by default to be safe for bare deployments.
// In production, prefer setting BASE_URL to avoid relying on req.protocol entirely.
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}
// ─── Middleware ───────────────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json({ limit: "2mb" }));
// Rate limiting: 60 chart-generation requests per minute per IP
const chartGenLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});
// Rate limiting for PNG endpoint: stricter than chart gen because PNG conversion
// via sharp is more CPU-intensive than SVG string generation
const pngLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later.", code: "RATE_LIMITED" },
});
// ─── Validation ──────────────────────────────────────────────────────────────
// Derive from CHART_TYPES in types.ts — avoids drift if new types are added
// ChartStyleSchema mirrors ChartStyle in types.ts — update both together
const ChartStyleSchema = zod_1.z.object({
    theme: zod_1.z.enum(["dark", "light"]).optional(),
    accentColor: zod_1.z.string().optional(),
    fontFamily: zod_1.z.string().optional(),
    width: zod_1.z.number().positive().optional(),
    height: zod_1.z.number().positive().optional(),
    showGrid: zod_1.z.boolean().optional(),
    showLegend: zod_1.z.boolean().optional(),
    showValues: zod_1.z.boolean().optional(),
}).optional();
// Note: if ChartStyle in types.ts gains new fields, add them here too.
const ChartRequestSchema = zod_1.z.object({
    type: zod_1.z.enum(types_js_1.CHART_TYPES, {
        errorMap: () => ({ message: `type must be one of: ${types_js_1.CHART_TYPES.join(", ")}` }),
    }),
    data: zod_1.z.array(zod_1.z.record(zod_1.z.unknown()).refine((obj) => typeof obj["label"] === "string", { message: "each data item must have a string \"label\" field" })).min(1, "data must have at least one item"),
    title: zod_1.z.string().optional(),
    xLabel: zod_1.z.string().optional(),
    yLabel: zod_1.z.string().optional(),
    seriesLabels: zod_1.z.array(zod_1.z.string()).optional(),
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
function resolveBaseUrl(req) {
    if (BASE_URL)
        return BASE_URL.replace(/\/$/, "");
    // In production, refuse to trust Host header — use safe fallback
    if (process.env.NODE_ENV === "production") {
        return `http://localhost:${PORT}`;
    }
    // Dev only: sanitize the host header for local convenience
    const rawHost = req.get("host") ?? "localhost";
    const safeHost = rawHost.replace(/[^a-zA-Z0-9.\-:[\]]/g, "").slice(0, 253);
    return `${req.protocol}://${safeHost}`;
}
/** Sanitize a user-supplied id for safe inclusion in error messages. */
function sanitizeId(id) {
    return id.replace(/[^\w-]/g, "").slice(0, 64);
}
/**
 * Strip dangerous elements from SVG content before serving.
 * Removes <script>, event handlers (onload, onclick, etc.), and <foreignObject>
 * to prevent stored XSS even if chart generators interpolate user strings unsafely.
 */
function sanitizeSvg(svg) {
    return svg
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<script[^>]*\/>/gi, "")
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
}
// ─── Routes ───────────────────────────────────────────────────────────────────
/**
 * GET /v1/health
 */
app.get("/v1/health", (_req, res) => {
    res.json({ status: "ok", version: VERSION });
});
/**
 * GET /v1/chart-types
 */
app.get("/v1/chart-types", (_req, res) => {
    res.json({ chartTypes: schemas_js_1.CHART_TYPE_INFO });
});
/**
 * GET /v1/chart-types/:type/schema
 */
app.get("/v1/chart-types/:type/schema", (req, res) => {
    const type = req.params["type"];
    // Use hasOwnProperty to prevent prototype-chain lookups (e.g. "constructor", "__proto__")
    const schema = Object.prototype.hasOwnProperty.call(schemas_js_1.CHART_SCHEMAS, type)
        ? schemas_js_1.CHART_SCHEMAS[type]
        : undefined;
    if (!schema) {
        res.status(404).json({
            error: `Unknown chart type: "${type}"`,
            code: "UNKNOWN_CHART_TYPE",
            supported: schemas_js_1.CHART_TYPE_INFO.map((c) => c.type),
        });
        return;
    }
    res.json({ type, schema });
});
/**
 * POST /v1/charts
 * Generate a chart → { chartId, type, svg, svgUrl, pngUrl }
 */
app.post("/v1/charts", chartGenLimiter, (req, res) => {
    try {
        // Reject non-object bodies explicitly before Zod for a clear error message
        if (Array.isArray(req.body) || typeof req.body !== "object" || req.body === null) {
            res.status(400).json({
                error: "Request body must be a JSON object",
                code: "INVALID_BODY",
            });
            return;
        }
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
        const input = parsed.data;
        const result = (0, index_js_1.generateChart)(input);
        // generateChart() enforces cache capacity before insertion.
        // scheduleEviction() sets a REST-specific TTL on the newly generated chart.
        scheduleEviction(result.chartId);
        const base = resolveBaseUrl(req);
        res.status(201).json({
            chartId: result.chartId,
            type: result.type,
            svg: result.svg,
            svgUrl: `${base}/v1/charts/${result.chartId}/svg`,
            pngUrl: `${base}/v1/charts/${result.chartId}/png`,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.status(400).json({ error: message, code: "CHART_GENERATION_FAILED" });
    }
});
/**
 * GET /v1/charts/:chartId/svg
 */
app.get("/v1/charts/:chartId/svg", (req, res) => {
    const chartId = req.params["chartId"];
    const svg = types_js_1.chartCache.get(chartId);
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
    res.end(sanitizeSvg(svg));
});
/**
 * GET /v1/charts/:chartId/png
 */
app.get("/v1/charts/:chartId/png", pngLimiter, async (req, res) => {
    const chartId = req.params["chartId"];
    const svg = types_js_1.chartCache.get(chartId);
    if (!svg) {
        res.status(404).json({ error: `Chart not found: ${sanitizeId(chartId)}`, code: "CHART_NOT_FOUND" });
        return;
    }
    try {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        const safeSvg = sanitizeSvg(svg);
        const png = await sharp(Buffer.from(safeSvg), { density: 144 }).png().toBuffer();
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(png);
    }
    catch (_err) {
        // Don't expose internal sharp/native error details to the client
        res.status(503).json({
            error: "PNG conversion failed. The chart may be invalid or the PNG renderer is unavailable.",
            code: "PNG_CONVERSION_FAILED",
        });
    }
});
// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});
// ─── Error handler ────────────────────────────────────────────────────────────
// Express requires 4-argument signature to identify error handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
});
// ─── Start ────────────────────────────────────────────────────────────────────
const httpServer = app.listen(PORT, () => {
    console.log(`Charta API v${VERSION} listening on http://localhost:${PORT}`);
    if (!BASE_URL && process.env.NODE_ENV === "production") {
        console.warn("⚠️  BASE_URL is not set. In production, svgUrl/pngUrl will use localhost as fallback. " +
            "Set BASE_URL to the public hostname for correct resource URLs.");
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
exports.default = app;
//# sourceMappingURL=api.js.map