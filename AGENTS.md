# Charta MCP — Agent Guide

This document is written for AI coding agents (Claude, Cursor, Windsurf, GPT, etc.) using the Charta MCP server to generate charts programmatically.

---

## Quick Start

Charta is a chart generation tool. The typical workflow is:

1. Call `list_chart_types` or `describe_chart` to decide which chart type to use
2. Call `generate_chart` with your data → receive an SVG + chartId
3. Optionally call `save_chart` to write the chart to disk as SVG or PNG

---

## Choosing a Chart Type

Use `describe_chart` when unsure. Here are the most common use cases:

| Situation | Recommended Type | Notes |
|-----------|-----------------|-------|
| Comparing values across categories | `bar` | Default choice for most comparisons |
| Comparing multiple groups per category | `grouped-bar` | Use `values[]` array per data point |
| Showing composition within categories | `stacked-bar` | Use `values[]` array per data point |
| Financial bridge / P&L / variance | `waterfall` | Use `isTotal: true` for base/result bars |
| Time series / trends | `line` | Use for continuous time data |
| Volume/magnitude over time | `area` | Like line but fills area for emphasis |
| Market share / proportions (≤6 items) | `pie` or `donut` | Donut shows total in center |
| X-Y correlation | `scatter` | Use `x` and `y` fields |
| 3-variable data (x, y, size) | `bubble` | Use `x`, `y`, and `size` fields |
| Project schedule / timeline | `gantt` | Use `start` and `end` fields |
| Market/segment analysis | `mekko` | Variable-width stacked bars |
| Multi-dimensional profile | `radar` | Values should be 0–100 (percentages) |
| Matrix/grid patterns | `heatmap` | Use `row`, `col`, `value` fields |

---

## Data Formats by Chart Type

### `bar`
```json
[
  {"label": "Q1", "value": 120},
  {"label": "Q2", "value": 180},
  {"label": "Q3", "value": 150}
]
```

### `grouped-bar`
```json
[
  {"label": "Q1", "values": [120, 80, 60]},
  {"label": "Q2", "values": [180, 110, 75]}
]
```
Pass `seriesLabels: ["Product A", "Product B", "Product C"]` for a legend.

### `stacked-bar`
Same format as `grouped-bar` — just use `type: "stacked-bar"`.

### `waterfall`
```json
[
  {"label": "Revenue", "value": 500, "isTotal": true},
  {"label": "+ Upsell", "value": 80},
  {"label": "- Churn", "value": -60},
  {"label": "- COGS", "value": -120},
  {"label": "Gross Profit", "value": 400, "isTotal": true}
]
```
**Important:** `isTotal: true` draws a full bar from zero. Delta bars automatically float from the running total. Positive values go up, negative go down. This is the most common mistake — do NOT use `isTotal: true` for delta bars.

### `line`
```json
[
  {"label": "Jan", "value": 100},
  {"label": "Feb", "value": 120},
  {"label": "Mar", "value": 115}
]
```
For multi-series, use `values[]`:
```json
[
  {"label": "Jan", "values": [100, 80]},
  {"label": "Feb", "values": [120, 95]}
]
```

### `area`
Same as `line` (single series only via `value`).

### `pie` / `donut`
```json
[
  {"label": "Direct", "value": 45},
  {"label": "Organic", "value": 30},
  {"label": "Referral", "value": 15},
  {"label": "Paid", "value": 10}
]
```
Values are automatically normalized to 100%. Keep to ≤6 categories for readability.

### `scatter`
```json
[
  {"label": "Company A", "x": 10, "y": 25},
  {"label": "Company B", "x": 40, "y": 60},
  {"label": "Company C", "x": 25, "y": 35}
]
```

### `bubble`
```json
[
  {"label": "Company A", "x": 10, "y": 25, "size": 40},
  {"label": "Company B", "x": 40, "y": 60, "size": 80},
  {"label": "Company C", "x": 25, "y": 35, "size": 20}
]
```
`size` is relative — the largest bubble fills ~10% of the chart width.

### `gantt`
```json
[
  {"label": "Discovery", "start": 0, "end": 14},
  {"label": "Design", "start": 7, "end": 28},
  {"label": "Development", "start": 21, "end": 70},
  {"label": "Testing", "start": 60, "end": 84},
  {"label": "Launch", "start": 80, "end": 90}
]
```
`start` and `end` can be any numeric unit (days, weeks, percentages, etc.).

### `mekko`
```json
[
  {"label": "North", "values": [40, 35, 25]},
  {"label": "South", "values": [30, 45, 25]},
  {"label": "East",  "values": [50, 30, 20]}
]
```
Column width is proportional to sum of `values`. Use `seriesLabels` for the legend.

### `radar`
```json
[
  {"label": "Speed",       "value": 80},
  {"label": "Quality",     "value": 90},
  {"label": "Cost",        "value": 60},
  {"label": "Support",     "value": 75},
  {"label": "Reliability", "value": 85}
]
```
Values should be 0–100 (interpreted as percentages of the max radius).

### `heatmap`
```json
[
  {"row": "Monday",    "col": "9am",  "value": 85},
  {"row": "Monday",    "col": "12pm", "value": 40},
  {"row": "Tuesday",   "col": "9am",  "value": 72},
  {"row": "Tuesday",   "col": "12pm", "value": 95}
]
```
All unique `row` and `col` values are automatically extracted.

---

## Example Workflows

### Workflow: Generate a waterfall chart from CSV data

Suppose you have P&L data from a CSV:

```
Item,Value
Revenue,1200
Cost of Goods,-400
Gross Profit,800
Operating Expenses,-250
EBITDA,550
Interest,-30
Net Income,520
```

1. Parse the CSV into data points
2. Mark `isTotal: true` on subtotal/total rows
3. Call `generate_chart`:

```json
{
  "type": "waterfall",
  "title": "P&L Waterfall",
  "data": [
    {"label": "Revenue", "value": 1200, "isTotal": true},
    {"label": "COGS", "value": -400},
    {"label": "Gross Profit", "value": 800, "isTotal": true},
    {"label": "OpEx", "value": -250},
    {"label": "EBITDA", "value": 550, "isTotal": true},
    {"label": "Interest", "value": -30},
    {"label": "Net Income", "value": 520, "isTotal": true}
  ]
}
```

4. Save to PNG: `save_chart` with `format: "png"`

### Workflow: Create a pitch deck chart

For a pitch deck, use `style` with `theme: "dark"` and a brand accent color:

```json
{
  "type": "bar",
  "title": "ARR Growth",
  "data": [
    {"label": "2021", "value": 1.2},
    {"label": "2022", "value": 3.8},
    {"label": "2023", "value": 9.1},
    {"label": "2024", "value": 18.5}
  ],
  "yLabel": "ARR ($M)",
  "style": {
    "theme": "dark",
    "accentColor": "#00D4AA",
    "fontFamily": "Inter, sans-serif",
    "width": 800,
    "height": 480,
    "showValues": true
  }
}
```

### Workflow: Compare multiple series

For a grouped bar comparing product revenue across regions:

```json
{
  "type": "grouped-bar",
  "title": "Revenue by Region & Product",
  "data": [
    {"label": "North", "values": [450, 320, 180]},
    {"label": "South", "values": [380, 290, 210]},
    {"label": "East",  "values": [520, 410, 150]},
    {"label": "West",  "values": [290, 380, 230]}
  ],
  "seriesLabels": ["Product A", "Product B", "Product C"]
}
```

### Workflow: Show project schedule

```json
{
  "type": "gantt",
  "title": "Product Launch Timeline",
  "data": [
    {"label": "Research",    "start": 0,  "end": 14},
    {"label": "Design",      "start": 10, "end": 30},
    {"label": "Development", "start": 25, "end": 75},
    {"label": "Beta",        "start": 65, "end": 85},
    {"label": "Launch",      "start": 80, "end": 90}
  ]
}
```

---

## Tips

- **Dark theme is the default** — great for dashboards and presentations. Use `"theme": "light"` for documents and reports.
- **chartId is session-scoped** — charts are cached in memory. If you need to save later, keep the chartId from `generate_chart`.
- **SVG is always returned** — even for PNG saves, the SVG is in the `generate_chart` response. You can embed SVGs directly in HTML.
- **Waterfall bars float automatically** — the running total is tracked internally. You only need to mark `isTotal: true` on base/result bars.
- **Negative values** are supported in bar, waterfall, line, area, and scatter charts.
- **Color overrides** — add a `"color": "#hex"` field to any data point to override its color.
- **Labels are truncated** at ~10 characters in bar/waterfall charts. Use short labels for readability.

---

## Error Handling

The server returns descriptive errors with examples when input is invalid:

```
Error: waterfall chart requires {label, value} data points. 2 item(s) missing "value" field. Example: [{label: "Q1", value: 100}, ...]
```

If you get an error, check:
1. Are you using the right data shape for the chart type? Use `get_chart_schema` to verify.
2. Are all required fields present?
3. Are negative values only used where supported?

---

## Links

- Website: [getcharta.ai](https://getcharta.ai)
