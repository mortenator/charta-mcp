#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

import { generateChart } from "./charts/index.js";
import { ChartInput, ChartType, chartCache } from "./types.js";
import { CHART_TYPE_INFO, CHART_SCHEMAS } from "./schemas.js";

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "generate_chart",
    description:
      "Generate a beautiful, presentation-ready chart and return it as an SVG string. " +
      "The chart is automatically cached and can be saved later with save_chart.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "waterfall", "bar", "grouped-bar", "stacked-bar",
            "line", "area", "pie", "donut", "scatter", "bubble",
            "gantt", "mekko", "radar", "heatmap",
          ],
          description: "The type of chart to generate",
        },
        data: {
          type: "array",
          description:
            "Data points. Shape varies by chart type — use list_chart_types or get_chart_schema for details.",
          items: { type: "object" },
        },
        title: {
          type: "string",
          description: "Optional chart title displayed at the top",
        },
        xLabel: {
          type: "string",
          description: "Optional X-axis label",
        },
        yLabel: {
          type: "string",
          description: "Optional Y-axis label",
        },
        seriesLabels: {
          type: "array",
          items: { type: "string" },
          description: "Series labels for multi-series charts (grouped-bar, stacked-bar, line with values[])",
        },
        style: {
          type: "object",
          description: "Optional styling options",
          properties: {
            theme: { type: "string", enum: ["dark", "light"], description: "dark (default) or light" },
            accentColor: { type: "string", description: "Primary accent color as hex, e.g. #7C5CFC" },
            fontFamily: { type: "string", description: "Font family, e.g. 'Inter, sans-serif'" },
            width: { type: "number", description: "Chart width in pixels (default: 600)" },
            height: { type: "number", description: "Chart height in pixels (default: 400)" },
            showGrid: { type: "boolean", description: "Show grid lines (default: true)" },
            showLegend: { type: "boolean", description: "Show legend (default: true)" },
            showValues: { type: "boolean", description: "Show value labels on chart elements (default: varies)" },
          },
        },
      },
      required: ["type", "data"],
    },
  },
  {
    name: "list_chart_types",
    description:
      "List all supported chart types with descriptions, required data shapes, and examples. " +
      "Use this to discover which chart type fits your data.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_chart_schema",
    description:
      "Get the full JSON schema for a specific chart type, including all required and optional fields.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "The chart type to get the schema for",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "save_chart",
    description:
      "Save a chart to a file as SVG or PNG. " +
      "Provide either a chartId (from a previous generate_chart call) or an SVG string directly.",
    inputSchema: {
      type: "object",
      properties: {
        chartId: {
          type: "string",
          description: "The chartId returned by generate_chart (preferred)",
        },
        svg: {
          type: "string",
          description: "SVG string to save directly (alternative to chartId)",
        },
        outputPath: {
          type: "string",
          description: "Absolute or relative path where the file should be saved, e.g. /tmp/chart.png or ./output/revenue.svg",
        },
        format: {
          type: "string",
          enum: ["svg", "png"],
          description: "Output format. PNG requires the 'sharp' package to be installed.",
        },
      },
      required: ["outputPath", "format"],
    },
  },
  {
    name: "describe_chart",
    description:
      "Given your data and context, recommend the best chart type and explain why. " +
      "Also suggests alternatives. Great for when you're not sure which chart to use.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "Your data array (can be partial/sample data)",
          items: { type: "object" },
        },
        context: {
          type: "string",
          description:
            "What you're trying to show or communicate. " +
            "E.g. 'quarterly revenue growth over 2 years', 'market share by product', 'project timeline'",
        },
      },
      required: ["data"],
    },
  },
];

// ─── Server setup ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "charta-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_chart": {
        const input = args as unknown as ChartInput & { seriesLabels?: string[] };
        const result = generateChart(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chartId: result.chartId,
                  type: result.type,
                  svg: result.svg,
                  message: `Chart generated successfully. Use save_chart with chartId "${result.chartId}" to save as PNG or SVG.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_chart_types": {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(CHART_TYPE_INFO, null, 2),
            },
          ],
        };
      }

      case "get_chart_schema": {
        const { type } = args as { type: string };
        const schema = CHART_SCHEMAS[type as ChartType];
        if (!schema) {
          const supported = Object.keys(CHART_SCHEMAS).join(", ");
          throw new Error(`Unknown chart type: "${type}". Supported types: ${supported}`);
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      }

      case "save_chart": {
        const { chartId, svg: svgInput, outputPath, format } = args as {
          chartId?: string;
          svg?: string;
          outputPath: string;
          format: "svg" | "png";
        };

        let svgContent: string;

        if (chartId) {
          const cached = chartCache.get(chartId);
          if (!cached) {
            throw new Error(
              `Chart "${chartId}" not found in cache. ` +
              `Charts are cached per-session only. Please regenerate the chart first.`
            );
          }
          svgContent = cached;
        } else if (svgInput) {
          svgContent = svgInput;
        } else {
          throw new Error("Provide either chartId or svg string");
        }

        // Ensure output directory exists
        const absPath = path.resolve(outputPath);
        const dir = path.dirname(absPath);
        fs.mkdirSync(dir, { recursive: true });

        if (format === "svg") {
          fs.writeFileSync(absPath, svgContent, "utf8");
          const bytes = Buffer.byteLength(svgContent, "utf8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path: absPath, bytes, format: "svg" }, null, 2),
              },
            ],
          };
        } else {
          // PNG via sharp
          let sharp: typeof import("sharp");
          try {
            sharp = (await import("sharp")).default as unknown as typeof import("sharp");
          } catch {
            throw new Error(
              "PNG export requires the 'sharp' package. " +
              "Install it with: npm install sharp"
            );
          }

          const buffer = await (sharp as any)(Buffer.from(svgContent)).png().toBuffer();
          fs.writeFileSync(absPath, buffer);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path: absPath, bytes: buffer.length, format: "png" }, null, 2),
              },
            ],
          };
        }
      }

      case "describe_chart": {
        const { data, context } = args as { data: Record<string, unknown>[]; context?: string };
        const result = describeChart(data, context);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── describe_chart logic ─────────────────────────────────────────────────────

function describeChart(
  data: Record<string, unknown>[],
  context?: string
): { recommended: ChartType; reason: string; alternatives: ChartType[] } {
  if (!data || data.length === 0) {
    return {
      recommended: "bar",
      reason: "No data provided — bar chart is a safe default for comparing values.",
      alternatives: ["line", "pie"],
    };
  }

  const first = data[0];
  const hasXY = "x" in first && "y" in first;
  const hasValues = "values" in first && Array.isArray(first.values);
  const hasRowCol = "row" in first && "col" in first;
  const hasStartEnd = "start" in first && "end" in first;
  const hasSize = "size" in first;
  const hasIsTotal = data.some((d) => "isTotal" in d);
  const n = data.length;
  const ctx = (context ?? "").toLowerCase();

  // Heuristics
  if (hasRowCol) {
    return { recommended: "heatmap", reason: "Data has row/col structure — heatmap is ideal for matrix data.", alternatives: ["mekko"] };
  }

  if (hasStartEnd) {
    return { recommended: "gantt", reason: "Data has start/end fields — Gantt chart shows task durations on a timeline.", alternatives: ["bar"] };
  }

  if (hasXY && hasSize) {
    return { recommended: "bubble", reason: "Data has x, y, and size fields — bubble chart encodes three variables.", alternatives: ["scatter"] };
  }

  if (hasXY) {
    return { recommended: "scatter", reason: "Data has x and y coordinates — scatter plot shows the relationship between two variables.", alternatives: ["bubble", "line"] };
  }

  if (hasIsTotal || ctx.includes("waterfall") || ctx.includes("bridge") || ctx.includes("variance") || ctx.includes("profit") || ctx.includes("p&l")) {
    return { recommended: "waterfall", reason: "Data or context suggests a financial bridge — waterfall chart shows cumulative impact of sequential values.", alternatives: ["bar"] };
  }

  if (hasValues) {
    const seriesCount = (first.values as unknown[]).length;
    if (ctx.includes("stack") || ctx.includes("composition") || ctx.includes("part")) {
      return { recommended: "stacked-bar", reason: "Multiple series with composition context — stacked bar shows part-to-whole within categories.", alternatives: ["mekko", "grouped-bar"] };
    }
    if (ctx.includes("market") || ctx.includes("share") || ctx.includes("segment")) {
      return { recommended: "mekko", reason: "Multiple series suggesting market/segment analysis — Marimekko chart encodes both share and size.", alternatives: ["stacked-bar", "grouped-bar"] };
    }
    return { recommended: "grouped-bar", reason: `Data has ${seriesCount} series — grouped bar chart compares them side by side.`, alternatives: ["stacked-bar", "line"] };
  }

  if (ctx.includes("radar") || ctx.includes("spider") || ctx.includes("dimension") || ctx.includes("profile") || ctx.includes("skill")) {
    return { recommended: "radar", reason: "Context suggests multi-dimensional comparison — radar/spider chart shows profiles across dimensions.", alternatives: ["bar"] };
  }

  if (n <= 6 && (ctx.includes("proportion") || ctx.includes("share") || ctx.includes("breakdown") || ctx.includes("distribution") || ctx.includes("pie"))) {
    return { recommended: "pie", reason: `${n} categories with proportion context — pie chart is clear for part-to-whole with few slices.`, alternatives: ["donut", "bar"] };
  }

  if (ctx.includes("donut") || ctx.includes("total")) {
    return { recommended: "donut", reason: "Donut chart shows proportions with a center metric.", alternatives: ["pie", "bar"] };
  }

  if (ctx.includes("trend") || ctx.includes("time") || ctx.includes("over") || ctx.includes("growth") || ctx.includes("series") || n > 12) {
    if (ctx.includes("area") || ctx.includes("volume") || ctx.includes("cumulative")) {
      return { recommended: "area", reason: "Time series context with volume emphasis — area chart highlights magnitude of change.", alternatives: ["line", "bar"] };
    }
    return { recommended: "line", reason: "Time series or trend context — line chart is the clearest for continuous data.", alternatives: ["area", "bar"] };
  }

  if (n > 8) {
    return { recommended: "bar", reason: `${n} categories — bar chart handles this well.`, alternatives: ["line", "area"] };
  }

  // Default
  return {
    recommended: "bar",
    reason: "Bar chart is the most versatile choice for comparing values across categories.",
    alternatives: ["line", "pie"],
  };
}

// ─── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server running — log to stderr to avoid polluting stdio protocol
  process.stderr.write("Charta MCP server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
