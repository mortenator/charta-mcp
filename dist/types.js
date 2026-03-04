"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chartCache = void 0;
exports.getTheme = getTheme;
exports.generateChartId = generateChartId;
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
exports.chartCache = new Map();
function generateChartId() {
    return `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
//# sourceMappingURL=types.js.map