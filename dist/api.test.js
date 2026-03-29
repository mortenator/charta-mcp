"use strict";
/**
 * Integration tests for Charta REST API v1
 * Run: npx ts-node src/api.test.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    }
    else {
        console.error(`  ❌ FAIL: ${label}`);
        failed++;
    }
}
// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const opts = {
            hostname: "localhost",
            port: TEST_PORT,
            path,
            method,
            headers: {
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
        };
        const req = http_1.default.request(opts, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
        });
        req.on("error", reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
async function json(method, path, body) {
    const res = await request(method, path, body);
    return { status: res.status, data: JSON.parse(res.body) };
}
// ─── Server management ────────────────────────────────────────────────────────
const TEST_PORT = 3099;
process.env.PORT = String(TEST_PORT);
async function startServer() {
    // Side-effect import: api.ts auto-starts the Express server on require.
    // The server runs for the duration of the test process and exits via process.exit().
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./api");
    // Wait for the server to bind
    await new Promise((resolve) => setTimeout(resolve, 300));
}
// ─── Test suites ─────────────────────────────────────────────────────────────
async function testHealth() {
    console.log("\n📋 GET /v1/health");
    const { status, data } = await json("GET", "/v1/health");
    assert(status === 200, "returns 200");
    assert(data.status === "ok", 'status === "ok"');
    assert(typeof data.version === "string", "version is a string");
}
async function testChartTypes() {
    console.log("\n📋 GET /v1/chart-types");
    const { status, data } = await json("GET", "/v1/chart-types");
    assert(status === 200, "returns 200");
    assert(Array.isArray(data.chartTypes), "chartTypes is an array");
    assert(data.chartTypes.length > 0, "at least one chart type returned");
}
async function testChartTypeSchema() {
    console.log("\n📋 GET /v1/chart-types/:type/schema");
    const { status, data } = await json("GET", "/v1/chart-types/bar/schema");
    assert(status === 200, "bar schema returns 200");
    assert(data.type === "bar", 'type === "bar"');
    assert(typeof data.schema === "object", "schema is an object");
    const { status: s2, data: d2 } = await json("GET", "/v1/chart-types/nonexistent/schema");
    assert(s2 === 404, "unknown type returns 404");
    assert(d2.code === "UNKNOWN_CHART_TYPE", 'code === "UNKNOWN_CHART_TYPE"');
}
async function testGenerateChart() {
    console.log("\n📋 POST /v1/charts");
    const { status, data } = await json("POST", "/v1/charts", {
        type: "bar",
        data: [
            { label: "Q1", value: 100 },
            { label: "Q2", value: 150 },
            { label: "Q3", value: 120 },
        ],
        title: "Test Chart",
    });
    assert(status === 201, "returns 201");
    assert(typeof data.chartId === "string", "chartId is a string");
    assert(typeof data.svg === "string" && data.svg.startsWith("<svg"), "svg is SVG content");
    assert(typeof data.svgUrl === "string", "svgUrl present");
    assert(typeof data.pngUrl === "string", "pngUrl present");
    // Invalid type (caught by zod schema validation before chart engine)
    const { status: s2, data: d2 } = await json("POST", "/v1/charts", {
        type: "invalid-type",
        data: [{ label: "A", value: 1 }],
    });
    assert(s2 === 400, "invalid type returns 400");
    assert(d2.code === "INVALID_BODY", "invalid type returns INVALID_BODY");
    // Empty data
    const { status: s3 } = await json("POST", "/v1/charts", {
        type: "bar",
        data: [],
    });
    assert(s3 === 400, "empty data returns 400");
    // Array body (bypass guard)
    const { status: s4, data: d4 } = await json("POST", "/v1/charts", []);
    assert(s4 === 400, "array body returns 400");
    assert(d4.code === "INVALID_BODY", "code is INVALID_BODY");
    // Missing required field
    const { status: s5 } = await json("POST", "/v1/charts", { type: "bar" });
    assert(s5 === 400, "missing data field returns 400");
    return data.chartId;
}
async function testGetSvg(chartId) {
    console.log("\n📋 GET /v1/charts/:chartId/svg");
    const res = await request("GET", `/v1/charts/${chartId}/svg`);
    assert(res.status === 200, "returns 200 for valid chartId");
    assert((res.headers["content-type"] ?? "").includes("svg"), "content-type is image/svg+xml");
    assert(res.body.startsWith("<svg"), "body is SVG content");
    // Not found
    const res2 = await request("GET", "/v1/charts/doesnotexist/svg");
    assert(res2.status === 404, "returns 404 for unknown chartId");
}
async function testGetPng(chartId) {
    console.log("\n📋 GET /v1/charts/:chartId/png");
    const res = await request("GET", `/v1/charts/${chartId}/png`);
    // PNG should work (sharp is installed); accept 200 or 503 if sharp unavailable
    assert(res.status === 200 || res.status === 503, "returns 200 or 503");
    if (res.status === 200) {
        assert((res.headers["content-type"] ?? "").includes("png"), "content-type is image/png");
    }
    // Not found
    const res2 = await request("GET", "/v1/charts/doesnotexist/png");
    assert(res2.status === 404, "returns 404 for unknown chartId");
}
async function testNotFound() {
    console.log("\n📋 404 fallback");
    const { status, data } = await json("GET", "/v1/doesnotexist");
    assert(status === 404, "unknown route returns 404");
    assert(data.code === "NOT_FOUND", 'code === "NOT_FOUND"');
}
// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
    console.log("🧪 Charta REST API v1 — Integration Tests\n");
    await startServer();
    try {
        await testHealth();
        await testChartTypes();
        await testChartTypeSchema();
        const chartId = await testGenerateChart();
        await testGetSvg(chartId);
        await testGetPng(chartId);
        await testNotFound();
    }
    catch (err) {
        console.error("Unexpected test error:", err);
        process.exit(1);
    }
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        console.error("❌ Some tests failed.");
        process.exit(1);
    }
    else {
        console.log("✅ All tests passed!");
        process.exit(0);
    }
})();
//# sourceMappingURL=api.test.js.map