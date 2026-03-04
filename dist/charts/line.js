"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLineChart = generateLineChart;
const types_js_1 = require("../types.js");
function fmt(n) {
    if (Math.abs(n) >= 1000000)
        return (n / 1000000).toFixed(1) + "M";
    if (Math.abs(n) >= 1000)
        return (n / 1000).toFixed(1) + "K";
    return n.toFixed(n % 1 === 0 ? 0 : 1);
}
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function niceNumber(max, min) {
    if (max <= 0)
        return 10;
    const range = max - Math.min(min, 0);
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    const fraction = range / magnitude;
    let nice;
    if (fraction <= 1)
        nice = 1;
    else if (fraction <= 2)
        nice = 2;
    else if (fraction <= 5)
        nice = 5;
    else
        nice = 10;
    return Math.ceil(max / (nice * magnitude)) * nice * magnitude;
}
function buildPath(points) {
    return points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
}
function generateLineChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const W = input.style?.width ?? 600;
    const H = input.style?.height ?? 400;
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    const showGrid = input.style?.showGrid !== false;
    const showLegend = input.style?.showLegend !== false;
    // Support multi-series via values[]
    const isMulti = input.data.some((d) => d.values && d.values.length > 0);
    const seriesCount = isMulti
        ? Math.max(...input.data.map((d) => d.values?.length ?? 0))
        : 1;
    const legendH = showLegend && isMulti ? 28 : 0;
    const padTop = input.title ? 50 : 20;
    const padBottom = 50 + legendH;
    const padLeft = 60;
    const padRight = 20;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    // Collect all values for axis
    const allVals = isMulti
        ? input.data.flatMap((d) => d.values ?? [])
        : input.data.map((d) => d.value ?? 0);
    const maxVal = Math.max(...allVals, 0);
    const minVal = Math.min(...allVals, 0);
    const niceMax = niceNumber(maxVal, minVal);
    const niceMin = minVal < 0 ? -niceNumber(Math.abs(minVal), 0) : 0;
    const niceRange = niceMax - niceMin;
    const n = input.data.length;
    const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;
    const xPx = (i) => padLeft + i * xStep;
    const yPx = (v) => padTop + chartH * (1 - (v - niceMin) / niceRange);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    // Grid lines
    if (showGrid) {
        for (let i = 0; i <= 5; i++) {
            const v = niceMin + (niceRange * i) / 5;
            const y = yPx(v);
            svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
            svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
        }
        // Vertical grid
        input.data.forEach((_, i) => {
            const x = xPx(i);
            svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="${theme.grid}" stroke-width="1" opacity="0.5"/>`;
        });
    }
    // Draw series
    if (isMulti) {
        for (let s = 0; s < seriesCount; s++) {
            const color = theme.palette[s % theme.palette.length];
            const points = input.data.map((d, i) => ({
                x: xPx(i),
                y: yPx(d.values?.[s] ?? 0),
            }));
            svg += `<path d="${buildPath(points)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
            points.forEach((p, i) => {
                const val = input.data[i].values?.[s] ?? 0;
                svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="${theme.background}" stroke-width="1.5"/>`;
                if (input.style?.showValues) {
                    svg += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="${theme.text}" font-size="10">${fmt(val)}</text>`;
                }
            });
        }
    }
    else {
        const color = theme.palette[0];
        const points = input.data.map((d, i) => ({
            x: xPx(i),
            y: yPx(d.value ?? 0),
        }));
        svg += `<path d="${buildPath(points)}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        points.forEach((p, i) => {
            const val = input.data[i].value ?? 0;
            svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="${theme.background}" stroke-width="1.5"/>`;
            if (input.style?.showValues) {
                svg += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="${theme.text}" font-size="10">${fmt(val)}</text>`;
            }
        });
    }
    // X labels
    const labelStep = Math.max(1, Math.ceil(n / 10));
    input.data.forEach((d, i) => {
        if (i % labelStep === 0 || i === n - 1) {
            svg += `<text x="${xPx(i)}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(truncate(d.label, 10))}</text>`;
        }
    });
    // Legend for multi-series
    if (showLegend && isMulti && input.seriesLabels) {
        const labels = input.seriesLabels;
        const legendY = H - legendH + 8;
        let lx = padLeft;
        labels.forEach((label, s) => {
            const c = theme.palette[s % theme.palette.length];
            svg += `<line x1="${lx}" y1="${legendY + 5}" x2="${lx + 14}" y2="${legendY + 5}" stroke="${c}" stroke-width="2.5"/>`;
            svg += `<circle cx="${lx + 7}" cy="${legendY + 5}" r="3" fill="${c}"/>`;
            svg += `<text x="${lx + 20}" y="${legendY + 9}" fill="${theme.subtext}" font-size="11">${esc(label)}</text>`;
            lx += label.length * 7 + 40;
        });
    }
    if (input.yLabel) {
        svg += `<text x="14" y="${padTop + chartH / 2}" text-anchor="middle" fill="${theme.subtext}" font-size="11" transform="rotate(-90, 14, ${padTop + chartH / 2})">${esc(input.yLabel)}</text>`;
    }
    if (input.xLabel) {
        svg += `<text x="${padLeft + chartW / 2}" y="${H - 6}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(input.xLabel)}</text>`;
    }
    svg += `</svg>`;
    return svg;
}
//# sourceMappingURL=line.js.map