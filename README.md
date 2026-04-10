# Charta MCP

Charta MCP is a Model Context Protocol server that lets AI coding agents generate beautiful, presentation-ready charts (SVG + PNG) with zero setup.

## Install & Run

```bash
npx @charta/mcp
```

## MCP Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "charta": {
      "command": "npx",
      "args": ["@charta/mcp"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "charta": {
      "command": "npx",
      "args": ["@charta/mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "charta": {
      "command": "npx",
      "args": ["@charta/mcp"]
    }
  }
}
```

---

## Tools

### `generate_chart`

Generate a chart and return an SVG string.

**Input:**
```json
{
  "type": "waterfall",
  "title": "Revenue Bridge Q1→Q2",
  "data": [
    {"label": "Q1 Revenue", "value": 500, "isTotal": true},
    {"label": "+ New Deals", "value": 120},
    {"label": "- Churn", "value": -45},
    {"label": "- Discounts", "value": -30},
    {"label": "Q2 Revenue", "value": 545, "isTotal": true}
  ],
  "style": {"theme": "dark", "accentColor": "#7C5CFC"}
}
```

**Output:**
```json
{
  "chartId": "chart_1234567890_abc123",
  "type": "waterfall",
  "svg": "<svg ...>...</svg>"
}
```

---

### `list_chart_types`

List all supported chart types with descriptions and data shapes.

**No input required.**

**Output:** Array of `{ type, description, dataShape, example }`

---

### `get_chart_schema`

Get the full JSON schema for a specific chart type.

**Input:** `{ "type": "waterfall" }`

**Output:** JSON Schema object

---

### `save_chart`

Save a chart to disk as SVG or PNG.

**Input:**
```json
{
  "chartId": "chart_1234567890_abc123",
  "outputPath": "/tmp/revenue-bridge.png",
  "format": "png"
}
```

**Output:** `{ "path": "/tmp/revenue-bridge.png", "bytes": 48291 }`

---

### `describe_chart`

Given your data and intent, get a chart type recommendation.

**Input:**
```json
{
  "data": [{"label": "Q1", "value": 100}, {"label": "Q2", "value": 120}],
  "context": "Show revenue growth over quarters"
}
```

**Output:**
```json
{
  "recommended": "line",
  "reason": "Time series context — line chart is the clearest for continuous data.",
  "alternatives": ["area", "bar"]
}
```

---

## Supported Chart Types

| Type | Description | Best For |
|------|-------------|----------|
| `bar` | Vertical bars | Comparing values across categories |
| `grouped-bar` | Side-by-side bars | Comparing multiple series per category |
| `stacked-bar` | Stacked bars | Composition + total across categories |
| `waterfall` | Floating bars with connectors | Financial bridges, P&L, variance analysis |
| `line` | Connected line | Trends, time series |
| `area` | Filled area under line | Volume/magnitude of trends |
| `pie` | Circular proportions | Part-to-whole (≤6 categories) |
| `donut` | Pie with center metric | Part-to-whole + total callout |
| `scatter` | X-Y points | Correlation between two variables |
| `bubble` | X-Y points + size | Three-variable relationships |
| `gantt` | Horizontal timeline bars | Project schedules, task durations |
| `mekko` | Variable-width stacked bars | Market share, segment analysis |
| `radar` | Spider/web chart | Multi-dimensional profiles |
| `heatmap` | Color-coded grid | Patterns across two categorical dimensions |

---

## Curl Examples

> **Note:** These show the MCP JSON-RPC protocol. In practice your agent calls the tools directly.

### List tools

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | npx @charta/mcp
```

### Generate a bar chart

```bash
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_chart",
    "arguments": {
      "type": "bar",
      "title": "Monthly Sales",
      "data": [
        {"label": "Jan", "value": 120},
        {"label": "Feb", "value": 180},
        {"label": "Mar", "value": 150},
        {"label": "Apr", "value": 210}
      ]
    }
  },
  "id": 2
}' | npx @charta/mcp
```

### Save chart to PNG

```bash
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "save_chart",
    "arguments": {
      "chartId": "chart_1234567890_abc123",
      "outputPath": "/tmp/sales.png",
      "format": "png"
    }
  },
  "id": 3
}' | npx @charta/mcp
```

### Get chart recommendation

```bash
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "describe_chart",
    "arguments": {
      "data": [{"label": "A", "value": 30}, {"label": "B", "value": 45}],
      "context": "market share breakdown"
    }
  },
  "id": 4
}' | npx @charta/mcp
```

---

## Styling

All charts support a `style` object:

```json
{
  "style": {
    "theme": "dark",
    "accentColor": "#7C5CFC",
    "fontFamily": "Inter, sans-serif",
    "width": 800,
    "height": 500,
    "showGrid": true,
    "showLegend": true,
    "showValues": true
  }
}
```

Default theme is **dark** (`#0a0a0a` background, `#7C5CFC` accent, white text).

---

## Python SDK

Install the typed Python client for use in notebooks, scripts, and AI agent pipelines:

```bash
pip install charta
```

```python
from charta import ChartaClient, BarChart, BarData, ChartStyle

chart = BarChart(
    title="Quarterly Revenue",
    data=[BarData(label="Q1", value=120), BarData(label="Q2", value=180)],
    style=ChartStyle(theme="dark"),
)

with ChartaClient("https://api.getcharta.ai", api_key="sk-...") as client:
    svg = client.generate_svg(chart)
```

Full docs: [python/README.md](python/README.md)

---

## Links

- Website: [getcharta.ai](https://getcharta.ai)
- Issues: [github.com/charta-ai/charta-mcp](https://github.com/mortenator/charta-mcp)
