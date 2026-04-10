# Charta Python SDK

Typed Python client for [Charta](https://getcharta.ai) — AI-powered chart generation with Pydantic models for all 14 chart types.

## Install

```bash
pip install charta
```

## Quick Start

### Typed Chart Schemas (offline, no server needed)

```python
from charta import BarChart, BarData, ChartStyle

# Full type safety and validation via Pydantic
chart = BarChart(
    title="Quarterly Revenue",
    data=[
        BarData(label="Q1", value=120),
        BarData(label="Q2", value=180),
        BarData(label="Q3", value=150),
        BarData(label="Q4", value=210),
    ],
    style=ChartStyle(theme="dark", accent_color="#7C5CFC"),
)

# Serialize to JSON for any Charta-compatible API
payload = chart.model_dump(by_alias=True, exclude_none=True)
```

### API Client (requires Charta server)

```python
from charta import ChartaClient, BarChart, BarData

with ChartaClient("https://api.getcharta.ai", api_key="sk-...") as client:
    result = client.generate(
        BarChart(
            title="Sales",
            data=[BarData(label="Q1", value=120), BarData(label="Q2", value=180)],
        )
    )
    print(result.chart_id)  # "chart_1234567890_abc123"
    print(result.svg[:40])  # "<svg xmlns=..."
```

### Async Client

```python
from charta import AsyncChartaClient, LineChart, LineData

async with AsyncChartaClient("https://api.getcharta.ai") as client:
    result = await client.generate(
        LineChart(
            title="Trend",
            data=[LineData(label="Jan", value=100), LineData(label="Feb", value=120)],
        )
    )
```

## Supported Chart Types

| Type | Model | Data Model | Best For |
|------|-------|------------|----------|
| `bar` | `BarChart` | `BarData` | Comparing values across categories |
| `grouped-bar` | `GroupedBarChart` | `GroupedBarData` | Comparing multiple series |
| `stacked-bar` | `StackedBarChart` | `StackedBarData` | Composition + totals |
| `waterfall` | `WaterfallChart` | `WaterfallData` | Financial bridges, P&L |
| `line` | `LineChart` | `LineData` | Trends, time series |
| `area` | `AreaChart` | `AreaData` | Volume/magnitude of trends |
| `pie` | `PieChart` | `PieData` | Part-to-whole (<=6 categories) |
| `donut` | `DonutChart` | `DonutData` | Part-to-whole + center metric |
| `scatter` | `ScatterChart` | `ScatterData` | Correlation between variables |
| `bubble` | `BubbleChart` | `BubbleData` | Three-variable relationships |
| `gantt` | `GanttChart` | `GanttData` | Project schedules |
| `mekko` | `MekkoChart` | `MekkoData` | Market share analysis |
| `radar` | `RadarChart` | `RadarData` | Multi-dimensional profiles |
| `heatmap` | `HeatmapChart` | `HeatmapData` | Two-dimensional patterns |

## Notebook Example

```python
from charta import WaterfallChart, WaterfallData, ChartaClient

chart = WaterfallChart(
    title="Revenue Bridge Q1 to Q2",
    data=[
        WaterfallData(label="Q1 Revenue", value=500, is_total=True),
        WaterfallData(label="+ New Deals", value=120),
        WaterfallData(label="- Churn", value=-45),
        WaterfallData(label="- Discounts", value=-30),
        WaterfallData(label="Q2 Revenue", value=545, is_total=True),
    ],
)

with ChartaClient() as client:
    svg = client.generate_svg(chart)

# Display in Jupyter
from IPython.display import SVG, display
display(SVG(svg))
```

## Serialization

All models serialize to camelCase JSON matching the Charta API:

```python
from charta import ScatterChart, ScatterData, ChartStyle

chart = ScatterChart(
    title="Correlation",
    data=[ScatterData(label="A", x=10, y=20)],
    style=ChartStyle(show_grid=True, accent_color="#22D3EE"),
    x_label="Revenue",
    y_label="Growth",
)

# camelCase output for API compatibility
chart.model_dump(by_alias=True, exclude_none=True)
# {
#   "type": "scatter",
#   "title": "Correlation",
#   "data": [{"label": "A", "x": 10, "y": 20}],
#   "style": {"showGrid": true, "accentColor": "#22D3EE"},
#   "xLabel": "Revenue",
#   "yLabel": "Growth"
# }
```

## Development

```bash
cd python
pip install -e ".[dev]"
pytest
```
