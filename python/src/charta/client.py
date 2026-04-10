"""HTTP client for the Charta REST API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from charta.models import ChartInput, ChartResult, ChartType


class ChartaError(Exception):
    """Raised when the Charta API returns an error."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(f"Charta API error {status_code}: {message}")


class ChartaClient:
    """Typed client for the Charta REST API.

    Usage::

        from charta import ChartaClient, BarChart, BarData

        client = ChartaClient("https://api.getcharta.ai")
        result = client.generate(
            BarChart(
                title="Sales",
                data=[BarData(label="Q1", value=120), BarData(label="Q2", value=180)],
            )
        )
        print(result.svg[:80])
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3000",
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        headers: Dict[str, str] = {}
        if api_key is not None:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    # -- Chart generation -----------------------------------------------------

    def generate(self, chart: ChartInput) -> ChartResult:
        """Generate a chart and return the SVG + chart ID.

        Accepts any typed chart model (BarChart, LineChart, etc.) or the
        generic ChartInput union.
        """
        payload = chart.model_dump(by_alias=True, exclude_none=True)
        response = self._client.post("/v1/charts", json=payload)
        _raise_for_status(response)
        body = response.json()
        return ChartResult.model_validate(body["data"])

    def generate_svg(self, chart: ChartInput) -> str:
        """Convenience: generate a chart and return the raw SVG string."""
        return self.generate(chart).svg

    # -- Chart types & schemas ------------------------------------------------

    def list_types(self) -> List[Dict[str, Any]]:
        """List all supported chart types with descriptions and examples."""
        response = self._client.get("/v1/chart-types")
        _raise_for_status(response)
        return response.json()["data"]

    def get_schema(self, chart_type: ChartType) -> Dict[str, Any]:
        """Get the JSON schema for a specific chart type."""
        response = self._client.get(f"/v1/chart-types/{chart_type}/schema")
        _raise_for_status(response)
        return response.json()["data"]

    # -- Lifecycle ------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._client.close()

    def __enter__(self) -> ChartaClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


class AsyncChartaClient:
    """Async version of the Charta API client.

    Usage::

        async with AsyncChartaClient("https://api.getcharta.ai") as client:
            result = await client.generate(chart)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3000",
        *,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        headers: Dict[str, str] = {}
        if api_key is not None:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    async def generate(self, chart: ChartInput) -> ChartResult:
        """Generate a chart and return the SVG + chart ID."""
        payload = chart.model_dump(by_alias=True, exclude_none=True)
        response = await self._client.post("/v1/charts", json=payload)
        _raise_for_status(response)
        body = response.json()
        return ChartResult.model_validate(body["data"])

    async def generate_svg(self, chart: ChartInput) -> str:
        """Convenience: generate a chart and return the raw SVG string."""
        return (await self.generate(chart)).svg

    async def list_types(self) -> List[Dict[str, Any]]:
        """List all supported chart types with descriptions and examples."""
        response = await self._client.get("/v1/chart-types")
        _raise_for_status(response)
        return response.json()["data"]

    async def get_schema(self, chart_type: ChartType) -> Dict[str, Any]:
        """Get the JSON schema for a specific chart type."""
        response = await self._client.get(f"/v1/chart-types/{chart_type}/schema")
        _raise_for_status(response)
        return response.json()["data"]

    async def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        await self._client.aclose()

    async def __aenter__(self) -> AsyncChartaClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()


def _raise_for_status(response: httpx.Response) -> None:
    """Raise ChartaError for non-2xx responses."""
    if response.is_success:
        return
    try:
        body = response.json()
        message = body.get("error", response.text)
    except Exception:
        message = response.text
    raise ChartaError(response.status_code, message)
