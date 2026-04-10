"""Tests for the Charta API client."""

from __future__ import annotations

import httpx
import pytest
import respx

from charta.client import AsyncChartaClient, ChartaClient, ChartaError
from charta.models import BarChart, BarData


BASE_URL = "https://api.test"


class TestChartaClient:
    @respx.mock
    def test_generate(self) -> None:
        route = respx.post(f"{BASE_URL}/v1/charts").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "svg": "<svg>test</svg>",
                        "chartId": "chart_1_abc",
                        "type": "bar",
                    },
                },
            )
        )

        chart = BarChart(data=[BarData(label="Q1", value=100)])
        with ChartaClient(BASE_URL) as client:
            result = client.generate(chart)

        assert result.svg == "<svg>test</svg>"
        assert result.chart_id == "chart_1_abc"
        assert result.type == "bar"
        assert route.called

    @respx.mock
    def test_generate_svg(self) -> None:
        respx.post(f"{BASE_URL}/v1/charts").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "svg": "<svg>hello</svg>",
                        "chartId": "chart_2_def",
                        "type": "bar",
                    },
                },
            )
        )

        chart = BarChart(data=[BarData(label="A", value=1)])
        with ChartaClient(BASE_URL) as client:
            svg = client.generate_svg(chart)

        assert svg == "<svg>hello</svg>"

    @respx.mock
    def test_error_handling(self) -> None:
        respx.post(f"{BASE_URL}/v1/charts").mock(
            return_value=httpx.Response(
                400,
                json={"success": False, "error": "Missing required field: data"},
            )
        )

        chart = BarChart(data=[BarData(label="A", value=1)])
        with ChartaClient(BASE_URL) as client:
            with pytest.raises(ChartaError) as exc_info:
                client.generate(chart)

        assert exc_info.value.status_code == 400
        assert "Missing required field" in exc_info.value.message

    @respx.mock
    def test_list_types(self) -> None:
        respx.get(f"{BASE_URL}/v1/chart-types").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": [{"type": "bar", "description": "Vertical bars"}],
                },
            )
        )

        with ChartaClient(BASE_URL) as client:
            types = client.list_types()

        assert len(types) == 1
        assert types[0]["type"] == "bar"

    @respx.mock
    def test_get_schema(self) -> None:
        respx.get(f"{BASE_URL}/v1/chart-types/bar/schema").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"type": "object"}},
            )
        )

        with ChartaClient(BASE_URL) as client:
            schema = client.get_schema("bar")

        assert schema["type"] == "object"

    def test_api_key_header(self) -> None:
        client = ChartaClient(BASE_URL, api_key="sk-test-123")
        assert client._client.headers["authorization"] == "Bearer sk-test-123"
        client.close()

    def test_trailing_slash_stripped(self) -> None:
        client = ChartaClient(f"{BASE_URL}/")
        assert str(client._client.base_url).rstrip("/") == BASE_URL
        client.close()


class TestAsyncChartaClient:
    @respx.mock
    @pytest.mark.asyncio
    async def test_generate(self) -> None:
        respx.post(f"{BASE_URL}/v1/charts").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "svg": "<svg>async</svg>",
                        "chartId": "chart_3_ghi",
                        "type": "line",
                    },
                },
            )
        )

        chart = BarChart(data=[BarData(label="A", value=1)])
        async with AsyncChartaClient(BASE_URL) as client:
            result = await client.generate(chart)

        assert result.svg == "<svg>async</svg>"
        assert result.chart_id == "chart_3_ghi"
