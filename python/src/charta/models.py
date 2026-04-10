"""Typed Pydantic models for all 14 Charta chart types."""

from __future__ import annotations

from typing import Annotated, List, Literal, Optional, Union

from pydantic import BaseModel, Field, conlist

# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------

ChartType = Literal[
    "bar",
    "grouped-bar",
    "stacked-bar",
    "waterfall",
    "line",
    "area",
    "pie",
    "donut",
    "scatter",
    "bubble",
    "gantt",
    "mekko",
    "radar",
    "heatmap",
]

CHART_TYPES: List[ChartType] = [
    "bar",
    "grouped-bar",
    "stacked-bar",
    "waterfall",
    "line",
    "area",
    "pie",
    "donut",
    "scatter",
    "bubble",
    "gantt",
    "mekko",
    "radar",
    "heatmap",
]


class ChartStyle(BaseModel):
    """Styling options for chart rendering."""

    theme: Optional[Literal["dark", "light"]] = None
    accent_color: Optional[str] = Field(None, alias="accentColor")
    font_family: Optional[str] = Field(None, alias="fontFamily")
    width: Optional[Annotated[int, Field(ge=200)]] = None
    height: Optional[Annotated[int, Field(ge=150)]] = None
    show_grid: Optional[bool] = Field(None, alias="showGrid")
    show_legend: Optional[bool] = Field(None, alias="showLegend")
    show_values: Optional[bool] = Field(None, alias="showValues")

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Generic DataPoint (matches TypeScript DataPoint interface)
# ---------------------------------------------------------------------------


class DataPoint(BaseModel):
    """Flexible data point matching the TypeScript DataPoint interface."""

    label: str
    value: Optional[float] = None
    values: Optional[List[float]] = None
    x: Optional[float] = None
    y: Optional[float] = None
    size: Optional[float] = None
    start: Optional[float] = None
    end: Optional[float] = None
    is_total: Optional[bool] = Field(None, alias="isTotal")
    row: Optional[str] = None
    col: Optional[str] = None
    color: Optional[str] = None

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Typed data-point models per chart type
# ---------------------------------------------------------------------------


class BarData(BaseModel):
    """Data point for bar charts."""

    label: str
    value: float
    color: Optional[str] = None


class GroupedBarData(BaseModel):
    """Data point for grouped-bar charts."""

    label: str
    values: Annotated[List[float], Field(min_length=1)]


class StackedBarData(BaseModel):
    """Data point for stacked-bar charts."""

    label: str
    values: Annotated[List[float], Field(min_length=1)]


class WaterfallData(BaseModel):
    """Data point for waterfall charts."""

    label: str
    value: float
    is_total: Optional[bool] = Field(None, alias="isTotal")

    model_config = {"populate_by_name": True}


class LineData(BaseModel):
    """Data point for line charts."""

    label: str
    value: float


class AreaData(BaseModel):
    """Data point for area charts."""

    label: str
    value: float


class PieData(BaseModel):
    """Data point for pie charts."""

    label: str
    value: float


class DonutData(BaseModel):
    """Data point for donut charts."""

    label: str
    value: float


class ScatterData(BaseModel):
    """Data point for scatter charts."""

    label: str
    x: float
    y: float


class BubbleData(BaseModel):
    """Data point for bubble charts."""

    label: str
    x: float
    y: float
    size: float


class GanttData(BaseModel):
    """Data point for gantt charts."""

    label: str
    start: float
    end: float


class MekkoData(BaseModel):
    """Data point for mekko (Marimekko) charts."""

    label: str
    values: List[float]


class RadarData(BaseModel):
    """Data point for radar charts."""

    label: str
    value: Annotated[float, Field(ge=0, le=100)]


class HeatmapData(BaseModel):
    """Data point for heatmap charts."""

    row: str
    col: str
    value: float


# ---------------------------------------------------------------------------
# Typed chart-input models per chart type
# ---------------------------------------------------------------------------


class BarChart(BaseModel):
    """Vertical bars comparing values across categories."""

    type: Literal["bar"] = "bar"
    data: Annotated[List[BarData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class GroupedBarChart(BaseModel):
    """Side-by-side bars for multiple series comparison."""

    type: Literal["grouped-bar"] = "grouped-bar"
    data: conlist(GroupedBarData, min_length=1)
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    series_labels: Optional[List[str]] = Field(None, alias="seriesLabels")
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class StackedBarChart(BaseModel):
    """Stacked bars showing composition and totals."""

    type: Literal["stacked-bar"] = "stacked-bar"
    data: conlist(StackedBarData, min_length=1)
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    series_labels: Optional[List[str]] = Field(None, alias="seriesLabels")
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class WaterfallChart(BaseModel):
    """Floating bars for financial bridges and variance analysis."""

    type: Literal["waterfall"] = "waterfall"
    data: Annotated[List[WaterfallData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class LineChart(BaseModel):
    """Connected points showing trends over time."""

    type: Literal["line"] = "line"
    data: Annotated[List[LineData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class AreaChart(BaseModel):
    """Line chart with filled area beneath."""

    type: Literal["area"] = "area"
    data: Annotated[List[AreaData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class PieChart(BaseModel):
    """Circular proportions chart (best with <= 6 categories)."""

    type: Literal["pie"] = "pie"
    data: Annotated[List[PieData], Field(min_length=2, max_length=12)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None

    model_config = {"populate_by_name": True}


class DonutChart(BaseModel):
    """Pie chart with center metric callout."""

    type: Literal["donut"] = "donut"
    data: Annotated[List[DonutData], Field(min_length=2, max_length=12)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None

    model_config = {"populate_by_name": True}


class ScatterChart(BaseModel):
    """X-Y points for correlation analysis."""

    type: Literal["scatter"] = "scatter"
    data: Annotated[List[ScatterData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class BubbleChart(BaseModel):
    """Scatter with size dimension for three-variable relationships."""

    type: Literal["bubble"] = "bubble"
    data: Annotated[List[BubbleData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    x_label: Optional[str] = Field(None, alias="xLabel")
    y_label: Optional[str] = Field(None, alias="yLabel")

    model_config = {"populate_by_name": True}


class GanttChart(BaseModel):
    """Horizontal timeline bars for project schedules."""

    type: Literal["gantt"] = "gantt"
    data: Annotated[List[GanttData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None

    model_config = {"populate_by_name": True}


class MekkoChart(BaseModel):
    """Variable-width stacked bars (Marimekko) for market share analysis."""

    type: Literal["mekko"] = "mekko"
    data: Annotated[List[MekkoData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None
    series_labels: Optional[List[str]] = Field(None, alias="seriesLabels")

    model_config = {"populate_by_name": True}


class RadarChart(BaseModel):
    """Spider/web chart for multi-dimensional profiles."""

    type: Literal["radar"] = "radar"
    data: Annotated[List[RadarData], Field(min_length=3)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None

    model_config = {"populate_by_name": True}


class HeatmapChart(BaseModel):
    """Color-coded grid matrix for two-dimensional patterns."""

    type: Literal["heatmap"] = "heatmap"
    data: Annotated[List[HeatmapData], Field(min_length=1)]
    title: Optional[str] = None
    style: Optional[ChartStyle] = None

    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Union type for any chart input (discriminated by "type" field)
# ---------------------------------------------------------------------------

ChartInput = Annotated[
    Union[
        BarChart,
        GroupedBarChart,
        StackedBarChart,
        WaterfallChart,
        LineChart,
        AreaChart,
        PieChart,
        DonutChart,
        ScatterChart,
        BubbleChart,
        GanttChart,
        MekkoChart,
        RadarChart,
        HeatmapChart,
    ],
    Field(discriminator="type"),
]


class ChartResult(BaseModel):
    """Result returned from chart generation.

    The Charta API returns camelCase `chartId`; snake_case `chart_id` is not part
    of the wire contract and is intentionally not accepted here.
    """

    svg: str
    chart_id: str = Field(alias="chartId")
    type: ChartType

    model_config = {}
