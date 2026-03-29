/** Canonical list of all supported chart types. */
export const CHART_TYPES = [
  "waterfall", "bar", "grouped-bar", "stacked-bar",
  "line", "area", "pie", "donut", "scatter", "bubble",
  "gantt", "mekko", "radar", "heatmap",
] as const;

export type ChartType = typeof CHART_TYPES[number];

export interface DataPoint {
  label: string;
  value?: number;
  values?: number[];
  // For scatter/bubble
  x?: number;
  y?: number;
  size?: number;
  // For gantt
  start?: number;
  end?: number;
  // For waterfall
  isTotal?: boolean;
  // For heatmap
  row?: string;
  col?: string;
  // Color override
  color?: string;
}

export interface ChartStyle {
  theme?: "dark" | "light";
  accentColor?: string;
  fontFamily?: string;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
}

export interface ChartInput {
  type: ChartType;
  data: DataPoint[];
  title?: string;
  style?: ChartStyle;
  xLabel?: string;
  yLabel?: string;
}

export interface ChartResult {
  svg: string;
  chartId: string;
  type: ChartType;
}

export interface ChartTypeInfo {
  type: ChartType;
  description: string;
  dataShape: string;
  example: DataPoint[];
}

export interface SaveChartInput {
  chartId?: string;
  svg?: string;
  outputPath: string;
  format: "svg" | "png";
}

export interface SaveChartResult {
  path: string;
  bytes: number;
}

export interface DescribeChartInput {
  data: DataPoint[];
  context?: string;
}

export interface DescribeChartResult {
  recommended: ChartType;
  reason: string;
  alternatives: ChartType[];
}

// Theme colors
export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  subtext: string;
  grid: string;
  border: string;
  accent: string;
  palette: string[];
}

export function getTheme(style?: ChartStyle): ThemeColors {
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
  } else {
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
 * If imported together in the same process they share this cache — the REST API
 * applies TTL eviction and a max-entries cap; MCP-generated entries are exempt
 * from that eviction logic and will persist until the process exits.
 */
export const chartCache = new Map<string, string>();

export function generateChartId(): string {
  // Use crypto.randomBytes for better entropy than Math.random
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return `chart_${Date.now()}_${randomBytes(6).toString("hex")}`;
}
