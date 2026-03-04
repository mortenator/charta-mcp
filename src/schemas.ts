import { ChartType, ChartTypeInfo } from "./types.js";

export const CHART_TYPE_INFO: ChartTypeInfo[] = [
  {
    type: "bar",
    description:
      "Vertical bars comparing values across categories. Best for comparing magnitudes.",
    dataShape: "Array of {label: string, value: number}",
    example: [
      { label: "Q1", value: 120 },
      { label: "Q2", value: 180 },
      { label: "Q3", value: 150 },
      { label: "Q4", value: 210 },
    ],
  },
  {
    type: "grouped-bar",
    description:
      "Side-by-side bars for multiple series. Best for comparing groups across categories.",
    dataShape: "Array of {label: string, values: number[], seriesLabels?: string[]}",
    example: [
      { label: "Q1", values: [120, 80] },
      { label: "Q2", values: [180, 110] },
      { label: "Q3", values: [150, 130] },
    ],
  },
  {
    type: "stacked-bar",
    description:
      "Stacked bars showing composition and totals. Best for part-to-whole relationships over categories.",
    dataShape: "Array of {label: string, values: number[]}",
    example: [
      { label: "Jan", values: [40, 30, 20] },
      { label: "Feb", values: [50, 35, 25] },
    ],
  },
  {
    type: "waterfall",
    description:
      "Floating bars showing cumulative effect of sequential values. Best for financial bridges and variance analysis.",
    dataShape:
      "Array of {label: string, value: number, isTotal?: boolean}. Positive values go up, negative go down. isTotal=true renders a full bar from zero.",
    example: [
      { label: "Revenue", value: 500, isTotal: true },
      { label: "+ Upsell", value: 80 },
      { label: "- Churn", value: -60 },
      { label: "- COGS", value: -120 },
      { label: "Net", value: 400, isTotal: true },
    ],
  },
  {
    type: "line",
    description:
      "Connected points showing trends over time. Best for continuous data and time series.",
    dataShape: "Array of {label: string, value: number} or {label: string, values: number[]}",
    example: [
      { label: "Jan", value: 100 },
      { label: "Feb", value: 120 },
      { label: "Mar", value: 115 },
      { label: "Apr", value: 140 },
    ],
  },
  {
    type: "area",
    description:
      "Line chart with filled area. Best for showing volume/magnitude of trends.",
    dataShape: "Array of {label: string, value: number}",
    example: [
      { label: "Jan", value: 100 },
      { label: "Feb", value: 120 },
      { label: "Mar", value: 115 },
      { label: "Apr", value: 140 },
    ],
  },
  {
    type: "pie",
    description:
      "Circular chart showing proportions. Best for part-to-whole with few categories (≤6).",
    dataShape: "Array of {label: string, value: number}",
    example: [
      { label: "Direct", value: 45 },
      { label: "Organic", value: 30 },
      { label: "Referral", value: 15 },
      { label: "Paid", value: 10 },
    ],
  },
  {
    type: "donut",
    description:
      "Pie chart with hole in center. Same use case as pie, allows center label.",
    dataShape: "Array of {label: string, value: number}",
    example: [
      { label: "Product A", value: 35 },
      { label: "Product B", value: 25 },
      { label: "Product C", value: 40 },
    ],
  },
  {
    type: "scatter",
    description:
      "Points on X-Y axes showing correlation. Best for relationships between two variables.",
    dataShape: "Array of {label: string, x: number, y: number}",
    example: [
      { label: "A", x: 10, y: 20 },
      { label: "B", x: 25, y: 45 },
      { label: "C", x: 40, y: 35 },
    ],
  },
  {
    type: "bubble",
    description:
      "Scatter plot with variable point sizes. Best for three-variable relationships.",
    dataShape: "Array of {label: string, x: number, y: number, size: number}",
    example: [
      { label: "A", x: 10, y: 20, size: 30 },
      { label: "B", x: 25, y: 45, size: 60 },
      { label: "C", x: 40, y: 35, size: 45 },
    ],
  },
  {
    type: "gantt",
    description:
      "Horizontal bars on timeline. Best for project schedules and task durations.",
    dataShape: "Array of {label: string, start: number, end: number}",
    example: [
      { label: "Design", start: 0, end: 30 },
      { label: "Development", start: 20, end: 70 },
      { label: "Testing", start: 60, end: 90 },
      { label: "Launch", start: 85, end: 100 },
    ],
  },
  {
    type: "mekko",
    description:
      "Variable-width stacked bars (Marimekko). Best for market share and segment analysis.",
    dataShape: "Array of {label: string, values: number[]}. Width is proportional to sum.",
    example: [
      { label: "North", values: [40, 35, 25] },
      { label: "South", values: [30, 45, 25] },
      { label: "East", values: [50, 30, 20] },
    ],
  },
  {
    type: "radar",
    description:
      "Spider/web chart showing multiple dimensions. Best for comparing profiles across dimensions.",
    dataShape: "Array of {label: string, value: number} where label is the dimension",
    example: [
      { label: "Speed", value: 80 },
      { label: "Quality", value: 90 },
      { label: "Cost", value: 60 },
      { label: "Support", value: 75 },
      { label: "Reliability", value: 85 },
    ],
  },
  {
    type: "heatmap",
    description:
      "Color-coded grid matrix. Best for showing patterns across two categorical dimensions.",
    dataShape: "Array of {row: string, col: string, value: number}",
    example: [
      { label: "Mon/Morning",   row: "Mon", col: "Morning",   value: 85 },
      { label: "Mon/Afternoon", row: "Mon", col: "Afternoon", value: 60 },
      { label: "Tue/Morning",   row: "Tue", col: "Morning",   value: 70 },
      { label: "Tue/Afternoon", row: "Tue", col: "Afternoon", value: 90 },
    ],
  },
];

export const CHART_SCHEMAS: Record<ChartType, object> = {
  bar: {
    type: "object",
    properties: {
      type: { const: "bar" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
            color: { type: "string", description: "Optional hex color override" },
          },
          required: ["label", "value"],
        },
        minItems: 1,
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  "grouped-bar": {
    type: "object",
    properties: {
      type: { const: "grouped-bar" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            values: { type: "array", items: { type: "number" } },
          },
          required: ["label", "values"],
        },
      },
      seriesLabels: { type: "array", items: { type: "string" } },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  "stacked-bar": {
    type: "object",
    properties: {
      type: { const: "stacked-bar" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            values: { type: "array", items: { type: "number" } },
          },
          required: ["label", "values"],
        },
      },
      seriesLabels: { type: "array", items: { type: "string" } },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  waterfall: {
    type: "object",
    properties: {
      type: { const: "waterfall" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
            isTotal: {
              type: "boolean",
              description: "If true, bar starts from zero (total bar)",
            },
          },
          required: ["label", "value"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  line: {
    type: "object",
    properties: {
      type: { const: "line" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
          },
          required: ["label", "value"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  area: {
    type: "object",
    properties: {
      type: { const: "area" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
          },
          required: ["label", "value"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  pie: {
    type: "object",
    properties: {
      type: { const: "pie" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
          },
          required: ["label", "value"],
        },
        minItems: 2,
        maxItems: 12,
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  donut: {
    type: "object",
    properties: {
      type: { const: "donut" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number" },
          },
          required: ["label", "value"],
        },
        minItems: 2,
        maxItems: 12,
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  scatter: {
    type: "object",
    properties: {
      type: { const: "scatter" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["label", "x", "y"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  bubble: {
    type: "object",
    properties: {
      type: { const: "bubble" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            size: { type: "number", description: "Bubble size (relative)" },
          },
          required: ["label", "x", "y", "size"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  gantt: {
    type: "object",
    properties: {
      type: { const: "gantt" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            start: { type: "number" },
            end: { type: "number" },
          },
          required: ["label", "start", "end"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  mekko: {
    type: "object",
    properties: {
      type: { const: "mekko" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            values: { type: "array", items: { type: "number" } },
          },
          required: ["label", "values"],
        },
      },
      seriesLabels: { type: "array", items: { type: "string" } },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  radar: {
    type: "object",
    properties: {
      type: { const: "radar" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "number", minimum: 0, maximum: 100 },
          },
          required: ["label", "value"],
        },
        minItems: 3,
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
  heatmap: {
    type: "object",
    properties: {
      type: { const: "heatmap" },
      title: { type: "string" },
      data: {
        type: "array",
        items: {
          type: "object",
          properties: {
            row: { type: "string" },
            col: { type: "string" },
            value: { type: "number" },
          },
          required: ["row", "col", "value"],
        },
      },
      style: { $ref: "#/$defs/style" },
    },
    required: ["type", "data"],
    $defs: styleSchema(),
  },
};

function styleSchema() {
  return {
    style: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["dark", "light"] },
        accentColor: { type: "string", description: "Hex color e.g. #7C5CFC" },
        fontFamily: { type: "string" },
        width: { type: "number", minimum: 200 },
        height: { type: "number", minimum: 150 },
        showGrid: { type: "boolean" },
        showLegend: { type: "boolean" },
        showValues: { type: "boolean" },
      },
    },
  };
}
