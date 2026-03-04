import { ChartInput, ChartResult, ChartType, generateChartId, chartCache } from "../types.js";
import { generateBarChart, generateGroupedBarChart, generateStackedBarChart } from "./bar.js";
import { generateWaterfallChart } from "./waterfall.js";
import { generateLineChart } from "./line.js";
import { generateAreaChart } from "./area.js";
import { generatePieChart, generateDonutChart } from "./pie.js";
import { generateScatterChart } from "./scatter.js";
import { generateGanttChart, generateMekkoChart, generateRadarChart, generateHeatmapChart } from "./extras.js";

export function generateChart(input: ChartInput): ChartResult {
  validateInput(input);

  let svg: string;

  switch (input.type) {
    case "bar":
      svg = generateBarChart(input);
      break;
    case "grouped-bar":
      svg = generateGroupedBarChart(input);
      break;
    case "stacked-bar":
      svg = generateStackedBarChart(input);
      break;
    case "waterfall":
      svg = generateWaterfallChart(input);
      break;
    case "line":
      svg = generateLineChart(input);
      break;
    case "area":
      svg = generateAreaChart(input);
      break;
    case "pie":
      svg = generatePieChart(input);
      break;
    case "donut":
      svg = generateDonutChart(input);
      break;
    case "scatter":
    case "bubble":
      svg = generateScatterChart(input);
      break;
    case "gantt":
      svg = generateGanttChart(input);
      break;
    case "mekko":
      svg = generateMekkoChart(input);
      break;
    case "radar":
      svg = generateRadarChart(input);
      break;
    case "heatmap":
      svg = generateHeatmapChart(input);
      break;
    default: {
      const t: never = input.type;
      throw new Error(`Unsupported chart type: ${t}`);
    }
  }

  const chartId = generateChartId();
  chartCache.set(chartId, svg);

  return { svg, chartId, type: input.type };
}

function validateInput(input: ChartInput): void {
  if (!input.type) {
    throw new Error("Missing required field: type");
  }

  if (!input.data || !Array.isArray(input.data)) {
    throw new Error("Missing required field: data (must be an array)");
  }

  if (input.data.length === 0) {
    throw new Error("data array is empty — provide at least one data point");
  }

  const SUPPORTED: ChartType[] = [
    "waterfall", "bar", "grouped-bar", "stacked-bar", "line", "area",
    "pie", "donut", "scatter", "bubble", "gantt", "mekko", "radar", "heatmap",
  ];

  if (!SUPPORTED.includes(input.type)) {
    throw new Error(
      `Unsupported chart type: "${input.type}". Supported types: ${SUPPORTED.join(", ")}`
    );
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
        throw new Error(
          `${input.type} chart requires {label, value} data points. ` +
          `${missing.length} item(s) missing "value" field. ` +
          `Example: [{label: "Q1", value: 100}, ...]`
        );
      }
      break;
    }
    case "grouped-bar":
    case "stacked-bar":
    case "mekko": {
      const missing = input.data.filter((d) => !d.values || !Array.isArray(d.values));
      if (missing.length > 0) {
        throw new Error(
          `${input.type} chart requires {label, values: number[]} data points. ` +
          `${missing.length} item(s) missing "values" array. ` +
          `Example: [{label: "Q1", values: [100, 80, 60]}, ...]`
        );
      }
      break;
    }
    case "pie":
    case "donut": {
      const missing = input.data.filter((d) => d.value === undefined);
      if (missing.length > 0) {
        throw new Error(
          `${input.type} chart requires {label, value} data points. ` +
          `Example: [{label: "Category A", value: 45}, ...]`
        );
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
        throw new Error(
          `${input.type} chart requires {label, x, y${input.type === "bubble" ? ", size" : ""}} data points. ` +
          `${missing.length} item(s) missing "x" or "y" field. ` +
          `Example: [{label: "Point A", x: 10, y: 20${input.type === "bubble" ? ", size: 30" : ""}}, ...]`
        );
      }
      break;
    }
    case "gantt": {
      const missing = input.data.filter((d) => d.start === undefined || d.end === undefined);
      if (missing.length > 0) {
        throw new Error(
          `gantt chart requires {label, start, end} data points. ` +
          `${missing.length} item(s) missing "start" or "end" field. ` +
          `Example: [{label: "Task A", start: 0, end: 30}, ...]`
        );
      }
      break;
    }
    case "heatmap": {
      const missing = input.data.filter((d) => !d.row || !d.col || d.value === undefined);
      if (missing.length > 0) {
        throw new Error(
          `heatmap chart requires {row, col, value} data points. ` +
          `${missing.length} item(s) missing required fields. ` +
          `Example: [{row: "Monday", col: "Morning", value: 85}, ...]`
        );
      }
      break;
    }
  }
}
