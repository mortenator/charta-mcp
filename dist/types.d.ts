export type ChartType = "waterfall" | "bar" | "grouped-bar" | "stacked-bar" | "line" | "area" | "pie" | "donut" | "scatter" | "bubble" | "gantt" | "mekko" | "radar" | "heatmap";
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
export declare const chartCache: Map<string, string>;
export declare function generateChartId(): string;
//# sourceMappingURL=types.d.ts.map