"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWaterfallChart = generateWaterfallChart;
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
    const absMax = Math.max(Math.abs(max), Math.abs(min), 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(absMax)));
    const fraction = absMax / magnitude;
    let nice;
    if (fraction <= 1)
        nice = 1;
    else if (fraction <= 2)
        nice = 2;
    else if (fraction <= 5)
        nice = 5;
    else
        nice = 10;
    return Math.ceil(absMax / (nice * magnitude)) * nice * magnitude;
}
function generateWaterfallChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const W = input.style?.width ?? 640;
    const H = input.style?.height ?? 420;
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    const showValues = input.style?.showValues !== false;
    const showGrid = input.style?.showGrid !== false;
    const padTop = input.title ? 50 : 20;
    const padBottom = 55;
    const padLeft = 65;
    const padRight = 20;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    // Compute running totals for floating bars
    // For isTotal bars, bar goes from 0 to the running total value
    // For delta bars, bar floats from running total to running total + value
    const bars = [];
    let running = 0;
    input.data.forEach((d) => {
        const val = d.value ?? 0;
        if (d.isTotal) {
            // Total bar: always drawn from 0
            running = val;
            bars.push({
                label: d.label,
                barStart: 0,
                barEnd: val,
                isTotal: true,
                value: val,
                runningTotal: val,
            });
        }
        else {
            // Delta bar: floats from current running total
            const from = running;
            const to = running + val;
            bars.push({
                label: d.label,
                barStart: from,
                barEnd: to,
                isTotal: false,
                value: val,
                runningTotal: to,
            });
            running = to;
        }
    });
    // Find axis range
    const allValues = bars.flatMap((b) => [b.barStart, b.barEnd]);
    const dataMax = Math.max(...allValues, 0);
    const dataMin = Math.min(...allValues, 0);
    const axisMax = niceNumber(dataMax, 0);
    const axisMin = dataMin < 0 ? -niceNumber(Math.abs(dataMin), 0) : 0;
    const axisRange = axisMax - axisMin;
    const yPx = (v) => padTop + chartH * (1 - (v - axisMin) / axisRange);
    const zeroY = yPx(0);
    const n = bars.length;
    const groupW = chartW / n;
    const barPad = Math.max(4, groupW * 0.18);
    const barW = groupW - barPad;
    // Colors
    const positiveColor = theme.palette[0]; // accent
    const negativeColor = theme.palette[4] ?? "#F43F5E";
    const totalColor = theme.palette[1] ?? "#22D3EE";
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    // Grid lines + y-axis labels
    const gridLines = 5;
    if (showGrid) {
        for (let i = 0; i <= gridLines; i++) {
            const v = axisMin + (axisRange * i) / gridLines;
            const y = yPx(v);
            svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
            svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
        }
    }
    // Zero axis line
    svg += `<line x1="${padLeft}" y1="${zeroY}" x2="${padLeft + chartW}" y2="${zeroY}" stroke="${theme.border}" stroke-width="1.5"/>`;
    // Draw bars and connectors
    bars.forEach((b, i) => {
        const x = padLeft + i * groupW + barPad / 2;
        const y1 = yPx(Math.max(b.barStart, b.barEnd));
        const y2 = yPx(Math.min(b.barStart, b.barEnd));
        const barH = Math.max(Math.abs(y2 - y1), 2);
        let color;
        if (b.isTotal) {
            color = totalColor;
        }
        else if (b.value >= 0) {
            color = positiveColor;
        }
        else {
            color = negativeColor;
        }
        svg += `<rect x="${x}" y="${y1}" width="${barW}" height="${barH}" fill="${color}" rx="3" opacity="0.92"/>`;
        // Value label above/below bar
        if (showValues) {
            const sign = b.value >= 0 ? "+" : "";
            const displayVal = b.isTotal ? fmt(b.value) : `${sign}${fmt(b.value)}`;
            const labelY = b.value >= 0 ? y1 - 5 : y2 + 13;
            svg += `<text x="${x + barW / 2}" y="${labelY}" text-anchor="middle" fill="${theme.text}" font-size="11" font-weight="500">${displayVal}</text>`;
        }
        // Connector line to next bar (dashed, at the top of current bar end value)
        if (i < bars.length - 1 && !bars[i + 1].isTotal) {
            const connectorY = yPx(b.runningTotal);
            const nextX = padLeft + (i + 1) * groupW + barPad / 2;
            svg += `<line x1="${x + barW}" y1="${connectorY}" x2="${nextX}" y2="${connectorY}" stroke="${theme.border}" stroke-width="1" stroke-dasharray="3,2"/>`;
        }
        // X label
        svg += `<text x="${x + barW / 2}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(truncate(b.label, 10))}</text>`;
    });
    // Y axis label
    if (input.yLabel) {
        svg += `<text x="14" y="${padTop + chartH / 2}" text-anchor="middle" fill="${theme.subtext}" font-size="11" transform="rotate(-90, 14, ${padTop + chartH / 2})">${esc(input.yLabel)}</text>`;
    }
    svg += `</svg>`;
    return svg;
}
//# sourceMappingURL=waterfall.js.map