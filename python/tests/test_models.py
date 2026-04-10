"""Tests for Charta typed chart models."""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from charta.models import (
    CHART_TYPES,
    BarChart,
    BarData,
    BubbleChart,
    BubbleData,
    ChartInput,
    ChartResult,
    ChartStyle,
    DonutChart,
    DonutData,
    GanttChart,
    GanttData,
    GroupedBarChart,
    GroupedBarData,
    HeatmapChart,
    HeatmapData,
    LineChart,
    LineData,
    MekkoChart,
    MekkoData,
    PieChart,
    PieData,
    RadarChart,
    RadarData,
    ScatterChart,
    ScatterData,
    StackedBarChart,
    StackedBarData,
    WaterfallChart,
    WaterfallData,
    AreaChart,
    AreaData,
)


chart_input_adapter = TypeAdapter(ChartInput)


class TestChartTypes:
    def test_all_14_types_present(self) -> None:
        assert len(CHART_TYPES) == 14

    def test_types_are_strings(self) -> None:
        for t in CHART_TYPES:
            assert isinstance(t, str)


class TestChartStyle:
    def test_defaults(self) -> None:
        style = ChartStyle()
        assert style.theme is None
        assert style.accent_color is None
        assert style.width is None

    def test_camel_case_alias(self) -> None:
        style = ChartStyle.model_validate({"accentColor": "#FF0000", "showGrid": True})
        assert style.accent_color == "#FF0000"
        assert style.show_grid is True

    def test_snake_case_field_name(self) -> None:
        style = ChartStyle(accent_color="#FF0000", show_grid=True)
        dumped = style.model_dump(by_alias=True, exclude_none=True)
        assert dumped["accentColor"] == "#FF0000"
        assert dumped["showGrid"] is True

    def test_width_minimum(self) -> None:
        with pytest.raises(ValidationError):
            ChartStyle(width=100)

    def test_height_minimum(self) -> None:
        with pytest.raises(ValidationError):
            ChartStyle(height=50)


class TestBarChart:
    def test_create(self) -> None:
        chart = BarChart(
            title="Sales",
            data=[BarData(label="Q1", value=100), BarData(label="Q2", value=200)],
        )
        assert chart.type == "bar"
        assert len(chart.data) == 2

    def test_serialize_to_api_json(self) -> None:
        chart = BarChart(
            data=[BarData(label="A", value=10)],
            style=ChartStyle(theme="dark"),
        )
        payload = chart.model_dump(by_alias=True, exclude_none=True)
        assert payload["type"] == "bar"
        assert payload["data"][0] == {"label": "A", "value": 10}
        assert payload["style"]["theme"] == "dark"

    def test_min_items(self) -> None:
        with pytest.raises(ValidationError):
            BarChart(data=[])

    def test_optional_color(self) -> None:
        data = BarData(label="X", value=5, color="#FF0000")
        assert data.color == "#FF0000"


class TestGroupedBarChart:
    def test_create(self) -> None:
        chart = GroupedBarChart(
            data=[GroupedBarData(label="Q1", values=[10, 20])],
            series_labels=["A", "B"],
        )
        payload = chart.model_dump(by_alias=True, exclude_none=True)
        assert payload["seriesLabels"] == ["A", "B"]


    def test_min_items(self) -> None:
        with pytest.raises(ValidationError):
            GroupedBarChart(data=[])


class TestStackedBarChart:
    def test_create(self) -> None:
        chart = StackedBarChart(
            data=[StackedBarData(label="Jan", values=[40, 30, 20])],
        )
        assert chart.type == "stacked-bar"


    def test_min_items(self) -> None:
        with pytest.raises(ValidationError):
            StackedBarChart(data=[])


class TestWaterfallChart:
    def test_create_with_totals(self) -> None:
        chart = WaterfallChart(
            title="P&L Bridge",
            data=[
                WaterfallData(label="Revenue", value=500, is_total=True),
                WaterfallData(label="+ Upsell", value=80),
                WaterfallData(label="- Churn", value=-60),
                WaterfallData(label="Net", value=520, is_total=True),
            ],
        )
        payload = chart.model_dump(by_alias=True, exclude_none=True)
        assert payload["data"][0]["isTotal"] is True
        assert payload["data"][1].get("isTotal") is None


class TestLineChart:
    def test_create(self) -> None:
        chart = LineChart(
            data=[LineData(label="Jan", value=100), LineData(label="Feb", value=120)],
        )
        assert chart.type == "line"


class TestAreaChart:
    def test_create(self) -> None:
        chart = AreaChart(
            data=[AreaData(label="Jan", value=100)],
        )
        assert chart.type == "area"


class TestPieChart:
    def test_create(self) -> None:
        chart = PieChart(
            data=[PieData(label="A", value=40), PieData(label="B", value=60)],
        )
        assert chart.type == "pie"

    def test_min_items(self) -> None:
        with pytest.raises(ValidationError):
            PieChart(data=[PieData(label="Only", value=100)])

    def test_max_items(self) -> None:
        data = [PieData(label=f"S{i}", value=i) for i in range(13)]
        with pytest.raises(ValidationError):
            PieChart(data=data)


class TestDonutChart:
    def test_create(self) -> None:
        chart = DonutChart(
            data=[DonutData(label="A", value=35), DonutData(label="B", value=65)],
        )
        assert chart.type == "donut"


class TestScatterChart:
    def test_create(self) -> None:
        chart = ScatterChart(
            data=[ScatterData(label="P1", x=10, y=20)],
        )
        assert chart.type == "scatter"


class TestBubbleChart:
    def test_create(self) -> None:
        chart = BubbleChart(
            data=[BubbleData(label="B1", x=10, y=20, size=30)],
        )
        assert chart.type == "bubble"


class TestGanttChart:
    def test_create(self) -> None:
        chart = GanttChart(
            data=[
                GanttData(label="Design", start=0, end=30),
                GanttData(label="Dev", start=20, end=70),
            ],
        )
        assert chart.type == "gantt"


class TestMekkoChart:
    def test_create(self) -> None:
        chart = MekkoChart(
            data=[MekkoData(label="North", values=[40, 35, 25])],
            series_labels=["Product A", "Product B", "Product C"],
        )
        assert chart.type == "mekko"


class TestRadarChart:
    def test_create(self) -> None:
        chart = RadarChart(
            data=[
                RadarData(label="Speed", value=80),
                RadarData(label="Quality", value=90),
                RadarData(label="Cost", value=60),
            ],
        )
        assert chart.type == "radar"

    def test_min_items(self) -> None:
        with pytest.raises(ValidationError):
            RadarChart(
                data=[RadarData(label="A", value=50), RadarData(label="B", value=60)],
            )

    def test_value_range(self) -> None:
        with pytest.raises(ValidationError):
            RadarData(label="Over", value=150)

        with pytest.raises(ValidationError):
            RadarData(label="Under", value=-10)


class TestHeatmapChart:
    def test_create(self) -> None:
        chart = HeatmapChart(
            data=[HeatmapData(row="Mon", col="Morning", value=85)],
        )
        assert chart.type == "heatmap"


class TestChartInputDiscriminator:
    def test_bar_discriminated(self) -> None:
        parsed = chart_input_adapter.validate_python(
            {"type": "bar", "data": [{"label": "X", "value": 10}]}
        )
        assert isinstance(parsed, BarChart)

    def test_waterfall_discriminated(self) -> None:
        parsed = chart_input_adapter.validate_python(
            {
                "type": "waterfall",
                "data": [{"label": "Start", "value": 100, "isTotal": True}],
            }
        )
        assert isinstance(parsed, WaterfallChart)

    def test_scatter_discriminated(self) -> None:
        parsed = chart_input_adapter.validate_python(
            {"type": "scatter", "data": [{"label": "P", "x": 1, "y": 2}]}
        )
        assert isinstance(parsed, ScatterChart)

    def test_invalid_type_rejected(self) -> None:
        with pytest.raises(ValidationError):
            chart_input_adapter.validate_python(
                {"type": "invalid", "data": [{"label": "X", "value": 1}]}
            )


class TestChartResult:
    def test_parse_api_response(self) -> None:
        result = ChartResult.model_validate(
            {"svg": "<svg></svg>", "chartId": "chart_123_abc", "type": "bar"}
        )
        assert result.chart_id == "chart_123_abc"
        assert result.type == "bar"

    def test_accept_snake_case_chart_id(self) -> None:
        result = ChartResult.model_validate(
            {"svg": "<svg></svg>", "chart_id": "chart_123_abc", "type": "bar"}
        )
        assert result.chart_id == "chart_123_abc"
