"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGanttChart = generateGanttChart;
exports.generateMekkoChart = generateMekkoChart;
exports.generateRadarChart = generateRadarChart;
exports.generateHeatmapChart = generateHeatmapChart;
const types_js_1 = require("../types.js");
function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
// ─── GANTT ───────────────────────────────────────────────────────────────────
function generateGanttChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const W = input.style?.width ?? 640;
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    const rowH = 36;
    const padTop = input.title ? 50 : 20;
    const padBottom = 40;
    const padLeft = 110;
    const padRight = 20;
    const n = input.data.length;
    const H = Math.max(input.style?.height ?? 0, padTop + padBottom + n * rowH + 10);
    const allStarts = input.data.map((d) => d.start ?? 0);
    const allEnds = input.data.map((d) => d.end ?? 0);
    const axisMin = Math.min(...allStarts, 0);
    const axisMax = Math.max(...allEnds, 100);
    const axisRange = axisMax - axisMin || 1;
    const chartW = W - padLeft - padRight;
    const xPx = (v) => padLeft + ((v - axisMin) / axisRange) * chartW;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    // Axis ticks
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
        const v = axisMin + (axisRange * i) / tickCount;
        const x = xPx(v);
        svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + n * rowH}" stroke="${theme.grid}" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${padTop + n * rowH + 16}" text-anchor="middle" fill="${theme.subtext}" font-size="10">${v.toFixed(0)}</text>`;
    }
    input.data.forEach((d, i) => {
        const y = padTop + i * rowH;
        const x1 = xPx(d.start ?? 0);
        const x2 = xPx(d.end ?? 0);
        const bW = Math.max(x2 - x1, 4);
        const color = d.color ?? theme.palette[i % theme.palette.length];
        // Row bg
        if (i % 2 === 0) {
            svg += `<rect x="${padLeft}" y="${y}" width="${chartW}" height="${rowH}" fill="${theme.surface}" opacity="0.5"/>`;
        }
        // Label
        svg += `<text x="${padLeft - 6}" y="${y + rowH / 2 + 4}" text-anchor="end" fill="${theme.text}" font-size="12">${esc(truncate(d.label, 12))}</text>`;
        // Bar
        svg += `<rect x="${x1}" y="${y + 8}" width="${bW}" height="${rowH - 16}" fill="${color}" rx="3" opacity="0.9"/>`;
        // Duration label on bar
        const dur = (d.end ?? 0) - (d.start ?? 0);
        if (bW > 30) {
            svg += `<text x="${x1 + bW / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle" fill="white" font-size="10" font-weight="500">${dur.toFixed(0)}</text>`;
        }
    });
    svg += `</svg>`;
    return svg;
}
// ─── MEKKO ───────────────────────────────────────────────────────────────────
function generateMekkoChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const W = input.style?.width ?? 640;
    const H = input.style?.height ?? 420;
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    const padTop = input.title ? 50 : 20;
    const padBottom = 40;
    const padLeft = 20;
    const padRight = 20;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const totals = input.data.map((d) => (d.values ?? []).reduce((a, b) => a + b, 0));
    const grandTotal = totals.reduce((a, b) => a + b, 0);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    let xCursor = padLeft;
    input.data.forEach((d, i) => {
        const colW = (totals[i] / grandTotal) * chartW;
        let yCursor = padTop + chartH;
        const vals = d.values ?? [];
        const colTotal = totals[i];
        vals.forEach((val, s) => {
            const segH = colTotal > 0 ? (val / colTotal) * chartH : 0;
            const color = theme.palette[s % theme.palette.length];
            yCursor -= segH;
            svg += `<rect x="${xCursor}" y="${yCursor.toFixed(1)}" width="${Math.max(colW - 2, 1).toFixed(1)}" height="${segH.toFixed(1)}" fill="${color}" stroke="${theme.background}" stroke-width="1"/>`;
            if (segH > 16 && colW > 30) {
                const pct = colTotal > 0 ? ((val / colTotal) * 100).toFixed(0) : "0";
                svg += `<text x="${(xCursor + colW / 2 - 1).toFixed(1)}" y="${(yCursor + segH / 2 + 4).toFixed(1)}" text-anchor="middle" fill="white" font-size="11" font-weight="500">${pct}%</text>`;
            }
        });
        // Column label
        svg += `<text x="${(xCursor + colW / 2).toFixed(1)}" y="${padTop + chartH + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(truncate(d.label, 10))}</text>`;
        // Width %
        const widthPct = grandTotal > 0 ? ((totals[i] / grandTotal) * 100).toFixed(0) : "0";
        svg += `<text x="${(xCursor + colW / 2).toFixed(1)}" y="${padTop + chartH + 30}" text-anchor="middle" fill="${theme.subtext}" font-size="10">${widthPct}%</text>`;
        xCursor += colW;
    });
    svg += `</svg>`;
    return svg;
}
// ─── RADAR ───────────────────────────────────────────────────────────────────
function generateRadarChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const W = input.style?.width ?? 520;
    const H = input.style?.height ?? 460;
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    const padTop = input.title ? 40 : 20;
    const padBottom = 20;
    const padSide = 60;
    const cx = W / 2;
    const cy = padTop + (H - padTop - padBottom) / 2;
    const maxR = Math.min((W - 2 * padSide) / 2, (H - padTop - padBottom) / 2);
    const n = input.data.length;
    const color = theme.palette[0];
    const levels = 5;
    function angleFor(i) {
        return ((i / n) * 2 * Math.PI) - Math.PI / 2;
    }
    function point(i, r) {
        const a = angleFor(i);
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    }
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="26" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    // Grid levels
    for (let l = 1; l <= levels; l++) {
        const r = (l / levels) * maxR;
        const pts = Array.from({ length: n }, (_, i) => point(i, r));
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
        svg += `<path d="${pathD}" fill="none" stroke="${theme.grid}" stroke-width="1"/>`;
        if (l === levels) {
            // percent label at top
            svg += `<text x="${cx}" y="${cy - r - 4}" text-anchor="middle" fill="${theme.subtext}" font-size="9">100</text>`;
        }
    }
    // Spokes
    for (let i = 0; i < n; i++) {
        const outer = point(i, maxR);
        svg += `<line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="${theme.grid}" stroke-width="1"/>`;
    }
    // Data polygon
    const dataPoints = input.data.map((d, i) => {
        const v = Math.min(Math.max(d.value ?? 0, 0), 100);
        return point(i, (v / 100) * maxR);
    });
    const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
    svg += `<path d="${dataPath}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    // Data dots
    dataPoints.forEach((p) => {
        svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="${theme.background}" stroke-width="1.5"/>`;
    });
    // Axis labels
    input.data.forEach((d, i) => {
        const labelR = maxR + 20;
        const p = point(i, labelR);
        const anchor = p.x < cx - 5 ? "end" : p.x > cx + 5 ? "start" : "middle";
        svg += `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="${anchor}" fill="${theme.text}" font-size="12" font-weight="500">${esc(d.label)}</text>`;
        // Value
        const valP = point(i, (Math.min(Math.max(d.value ?? 0, 0), 100) / 100) * maxR);
        svg += `<text x="${(valP.x + (p.x > cx ? 6 : -6)).toFixed(1)}" y="${(valP.y - 4).toFixed(1)}" text-anchor="${anchor}" fill="${theme.subtext}" font-size="10">${d.value}</text>`;
    });
    svg += `</svg>`;
    return svg;
}
// ─── HEATMAP ─────────────────────────────────────────────────────────────────
function generateHeatmapChart(input) {
    const theme = (0, types_js_1.getTheme)(input.style);
    const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
    // Extract unique rows and cols
    const rows = [...new Set(input.data.map((d) => d.row ?? ""))];
    const cols = [...new Set(input.data.map((d) => d.col ?? ""))];
    const padTop = input.title ? 50 : 20;
    const padBottom = 40;
    const padLeft = 80;
    const padRight = 30;
    const cellW = Math.max(40, Math.min(80, 500 / cols.length));
    const cellH = Math.max(28, Math.min(60, 400 / rows.length));
    const W = input.style?.width ?? padLeft + cols.length * cellW + padRight;
    const H = input.style?.height ?? padTop + rows.length * cellH + padBottom;
    const values = input.data.map((d) => d.value ?? 0);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const valRange = maxVal - minVal || 1;
    function cellColor(v) {
        const t = (v - minVal) / valRange;
        // Interpolate: low = dim blue → high = accent
        const accent = theme.accent;
        // Parse hex
        const r = parseInt(accent.slice(1, 3), 16);
        const g = parseInt(accent.slice(3, 5), 16);
        const b = parseInt(accent.slice(5, 7), 16);
        const bgR = theme.background === "#0a0a0a" ? 20 : 220;
        const bgG = bgR;
        const bgB = bgR + 30;
        const cr = Math.round(bgR + t * (r - bgR));
        const cg = Math.round(bgG + t * (g - bgG));
        const cb = Math.round(bgB + t * (b - bgB));
        return `rgb(${cr},${cg},${cb})`;
    }
    function textColor(v) {
        const t = (v - minVal) / valRange;
        return t > 0.5 ? "white" : theme.subtext;
    }
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
    svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;
    if (input.title) {
        svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
    }
    // Column headers
    cols.forEach((col, ci) => {
        const x = padLeft + ci * cellW + cellW / 2;
        svg += `<text x="${x}" y="${padTop - 6}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(truncate(col, 8))}</text>`;
    });
    // Row labels + cells
    rows.forEach((row, ri) => {
        const y = padTop + ri * cellH;
        svg += `<text x="${padLeft - 6}" y="${y + cellH / 2 + 4}" text-anchor="end" fill="${theme.text}" font-size="11">${esc(truncate(row, 10))}</text>`;
        cols.forEach((col, ci) => {
            const datum = input.data.find((d) => d.row === row && d.col === col);
            const val = datum?.value ?? 0;
            const x = padLeft + ci * cellW;
            const bg = cellColor(val);
            const tc = textColor(val);
            svg += `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="${bg}" rx="2"/>`;
            svg += `<text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle" fill="${tc}" font-size="11" font-weight="500">${val}</text>`;
        });
    });
    svg += `</svg>`;
    return svg;
}
//# sourceMappingURL=extras.js.map