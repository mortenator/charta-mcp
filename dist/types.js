"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_MAX_ENTRIES = exports.chartCache = exports.CHART_TYPES = void 0;
exports.getTheme = getTheme;
exports.enforceCapacity = enforceCapacity;
exports.generateChartId = generateChartId;
/** Canonical list of all supported chart types. */
exports.CHART_TYPES = [
    "waterfall", "bar", "grouped-bar", "stacked-bar",
    "line", "area", "pie", "donut", "scatter", "bubble",
    "gantt", "mekko", "radar", "heatmap",
];
function getTheme(style) {
    const isDark = !style?.theme || style.theme === "dark";
    const accent = style?.accentColor ?? "#7C5CFC";
    const palette = [
        accent,
        "#22D3EE",
        "#F59E0B",
        "#10B981",
        "#F43F5E",
        "#818CF8",
        "#FB923C",
        "#A3E635",
    ];
    if (isDark) {
        return {
            background: "#0a0a0a",
            surface: "#141414",
            text: "#FFFFFF",
            subtext: "#9CA3AF",
            grid: "#1F1F1F",
            border: "#2D2D2D",
            accent,
            palette,
        };
    }
    else {
        return {
            background: "#FFFFFF",
            surface: "#F9FAFB",
            text: "#111827",
            subtext: "#6B7280",
            grid: "#E5E7EB",
            border: "#D1D5DB",
            accent,
            palette: [
                accent,
                "#0891B2",
                "#D97706",
                "#059669",
                "#E11D48",
                "#6366F1",
                "#EA580C",
                "#65A30D",
            ],
        };
    }
}
// Stored chart cache (in-memory for session)
/**
 * Shared in-memory chart cache (chartId → SVG string).
 * Both the MCP server (src/index.ts) and the REST API (src/api.ts) import this.
 * When running as separate processes they each have their own instance.
 * The cache enforces a max-entries cap via enforceCapacity() called at insertion
 * time in generateChart(). The REST API additionally applies TTL eviction via
 * scheduleEviction().
 */
exports.chartCache = new Map();
/** Max cache entries. Eviction removes the oldest entry (Map insertion order). */
exports.CACHE_MAX_ENTRIES = 500;
/** Evict oldest entry if cache exceeds capacity. Called before each insertion. */
function enforceCapacity() {
    if (exports.chartCache.size >= exports.CACHE_MAX_ENTRIES) {
        const firstKey = exports.chartCache.keys().next().value;
        if (firstKey !== undefined) {
            exports.chartCache.delete(firstKey);
        }
    }
}
const crypto_1 = require("crypto");
function generateChartId() {
    // Use crypto.randomBytes for better entropy than Math.random
    return `chart_${Date.now()}_${(0, crypto_1.randomBytes)(6).toString("hex")}`;
}
//# sourceMappingURL=types.js.map