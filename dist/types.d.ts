/** Canonical list of all supported chart types. */
export declare const CHART_TYPES: readonly ["waterfall", "bar", "grouped-bar", "stacked-bar", "line", "area", "pie", "donut", "scatter", "bubble", "gantt", "mekko", "radar", "heatmap"];
export type ChartType = typeof CHART_TYPES[number];
export interface DataPoint {
    label: string;
    value?: number;
    values?: number[];
    x?: number;
    y?: number;
    size?: number;
    start?: number;
    end?: number;
    isTotal?: boolean;
    row?: string;
    col?: string;
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
export declare function getTheme(style?: ChartStyle): ThemeColors;
/**
 * Shared in-memory chart cache (chartId → SVG string).
 * Both the MCP server (src/index.ts) and the REST API (src/api.ts) import this.
 * When running as separate processes they each have their own instance.
 * The cache enforces a max-entries cap via enforceCapacity() called at insertion
 * time in generateChart(). The REST API additionally applies TTL eviction via
 * scheduleEviction().
 */
export declare const chartCache: Map<string, string>;
/** Max cache entries. Eviction removes the oldest entry (Map insertion order). */
export declare const CACHE_MAX_ENTRIES = 500;
/** Evict oldest entry if cache exceeds capacity. Called before each insertion. */
export declare function enforceCapacity(): void;
export declare function generateChartId(): string;
//# sourceMappingURL=types.d.ts.map