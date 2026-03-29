"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChart = generateChart;
const types_js_1 = require("../types.js");
const bar_js_1 = require("./bar.js");
const waterfall_js_1 = require("./waterfall.js");
const line_js_1 = require("./line.js");
const area_js_1 = require("./area.js");
const pie_js_1 = require("./pie.js");
const scatter_js_1 = require("./scatter.js");
const extras_js_1 = require("./extras.js");
function generateChart(input) {
    validateInput(input);
    let svg;
    switch (input.type) {
        case "bar":
            svg = (0, bar_js_1.generateBarChart)(input);
            break;
        case "grouped-bar":
            svg = (0, bar_js_1.generateGroupedBarChart)(input);
            break;
        case "stacked-bar":
            svg = (0, bar_js_1.generateStackedBarChart)(input);
            break;
        case "waterfall":
            svg = (0, waterfall_js_1.generateWaterfallChart)(input);
            break;
        case "line":
            svg = (0, line_js_1.generateLineChart)(input);
            break;
        case "area":
            svg = (0, area_js_1.generateAreaChart)(input);
            break;
        case "pie":
            svg = (0, pie_js_1.generatePieChart)(input);
            break;
        case "donut":
            svg = (0, pie_js_1.generateDonutChart)(input);
            break;
        case "scatter":
        case "bubble":
            svg = (0, scatter_js_1.generateScatterChart)(input);
            break;
        case "gantt":
            svg = (0, extras_js_1.generateGanttChart)(input);
            break;
        case "mekko":
            svg = (0, extras_js_1.generateMekkoChart)(input);
            break;
        case "radar":
            svg = (0, extras_js_1.generateRadarChart)(input);
            break;
        case "heatmap":
            svg = (0, extras_js_1.generateHeatmapChart)(input);
            break;
        default: {
            const t = input.type;
            throw new Error(`Unsupported chart type: ${t}`);
        }
    }
    const chartId = (0, types_js_1.generateChartId)();
    (0, types_js_1.enforceCapacity)();
    types_js_1.chartCache.set(chartId, svg);
    return { svg, chartId, type: input.type };
}
function validateInput(input) {
    if (!input.type) {
        throw new Error("Missing required field: type");
    }
    if (!input.data || !Array.isArray(input.data)) {
        throw new Error("Missing required field: data (must be an array)");
    }
    if (input.data.length === 0) {
        throw new Error("data array is empty — provide at least one data point");
    }
    if (!types_js_1.CHART_TYPES.includes(input.type)) {
        throw new Error(`Unsupported chart type: "${input.type}". Supported types: ${types_js_1.CHART_TYPES.join(", ")}`);
    }
    // Type-specific validation
    switch (input.type) {
        case "bar":
        case "line":
        case "area":
        case "waterfall":
        case "radar": {
            const missing = input.data.filter((d) => d.value === undefined && d.values === undefined);
            if (missing.length > 0) {
                throw new Error(`${input.type} chart requires {label, value} data points. ` +
                    `${missing.length} item(s) missing "value" field. ` +
                    `Example: [{label: "Q1", value: 100}, ...]`);
            }
            break;
        }
        case "grouped-bar":
        case "stacked-bar":
        case "mekko": {
            const missing = input.data.filter((d) => !d.values || !Array.isArray(d.values));
            if (missing.length > 0) {
                throw new Error(`${input.type} chart requires {label, values: number[]} data points. ` +
                    `${missing.length} item(s) missing "values" array. ` +
                    `Example: [{label: "Q1", values: [100, 80, 60]}, ...]`);
            }
            break;
        }
        case "pie":
        case "donut": {
            const missing = input.data.filter((d) => d.value === undefined);
            if (missing.length > 0) {
                throw new Error(`${input.type} chart requires {label, value} data points. ` +
                    `Example: [{label: "Category A", value: 45}, ...]`);
            }
            const negatives = input.data.filter((d) => (d.value ?? 0) < 0);
            if (negatives.length > 0) {
                throw new Error(`${input.type} chart does not support negative values`);
            }
            break;
        }
        case "scatter":
        case "bubble": {
            const missing = input.data.filter((d) => d.x === undefined || d.y === undefined);
            if (missing.length > 0) {
                throw new Error(`${input.type} chart requires {label, x, y${input.type === "bubble" ? ", size" : ""}} data points. ` +
                    `${missing.length} item(s) missing "x" or "y" field. ` +
                    `Example: [{label: "Point A", x: 10, y: 20${input.type === "bubble" ? ", size: 30" : ""}}, ...]`);
            }
            break;
        }
        case "gantt": {
            const missing = input.data.filter((d) => d.start === undefined || d.end === undefined);
            if (missing.length > 0) {
                throw new Error(`gantt chart requires {label, start, end} data points. ` +
                    `${missing.length} item(s) missing "start" or "end" field. ` +
                    `Example: [{label: "Task A", start: 0, end: 30}, ...]`);
            }
            break;
        }
        case "heatmap": {
            const missing = input.data.filter((d) => !d.row || !d.col || d.value === undefined);
            if (missing.length > 0) {
                throw new Error(`heatmap chart requires {row, col, value} data points. ` +
                    `${missing.length} item(s) missing required fields. ` +
                    `Example: [{row: "Monday", col: "Morning", value: 85}, ...]`);
            }
            break;
        }
    }
}
//# sourceMappingURL=index.js.map