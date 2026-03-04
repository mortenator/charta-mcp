import { ChartInput, getTheme } from "../types.js";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function niceNumber(max: number, min: number): number {
  if (max <= 0) return 10;
  const range = max - Math.min(min, 0);
  const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
  const fraction = range / magnitude;
  let nice: number;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return Math.ceil(max / (nice * magnitude)) * nice * magnitude;
}

export function generateAreaChart(input: ChartInput): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 600;
  const H = input.style?.height ?? 400;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showGrid = input.style?.showGrid !== false;

  const padTop = input.title ? 50 : 20;
  const padBottom = 50;
  const padLeft = 60;
  const padRight = 20;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const values = input.data.map((d) => d.value ?? 0);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const niceMax = niceNumber(maxVal, minVal);
  const niceMin = minVal < 0 ? -niceNumber(Math.abs(minVal), 0) : 0;
  const niceRange = niceMax - niceMin;

  const n = input.data.length;
  const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;

  const xPx = (i: number) => padLeft + i * xStep;
  const yPx = (v: number) => padTop + chartH * (1 - (v - niceMin) / niceRange);
  const zeroY = yPx(0);

  const color = theme.palette[0];
  const gradId = `area-grad-${Math.random().toString(36).slice(2, 6)}`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  if (input.title) {
    svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  if (showGrid) {
    for (let i = 0; i <= 5; i++) {
      const v = niceMin + (niceRange * i) / 5;
      const y = yPx(v);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
  }

  // Build path points
  const pts = input.data.map((d, i) => ({ x: xPx(i), y: yPx(d.value ?? 0) }));

  // Area fill path: line + down to zero + back
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const lastX = pts[pts.length - 1].x;
  const firstX = pts[0].x;
  const areaPath = `${linePath} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${firstX.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  svg += `<path d="${areaPath}" fill="url(#${gradId})"/>`;
  svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Dots
  pts.forEach((p, i) => {
    const val = input.data[i].value ?? 0;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="${theme.background}" stroke-width="1.5"/>`;
    if (input.style?.showValues) {
      svg += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="${theme.text}" font-size="10">${fmt(val)}</text>`;
    }
  });

  // X labels
  const labelStep = Math.max(1, Math.ceil(n / 10));
  input.data.forEach((d, i) => {
    if (i % labelStep === 0 || i === n - 1) {
      svg += `<text x="${xPx(i)}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(truncate(d.label, 10))}</text>`;
    }
  });

  if (input.yLabel) {
    svg += `<text x="14" y="${padTop + chartH / 2}" text-anchor="middle" fill="${theme.subtext}" font-size="11" transform="rotate(-90, 14, ${padTop + chartH / 2})">${esc(input.yLabel)}</text>`;
  }
  if (input.xLabel) {
    svg += `<text x="${padLeft + chartW / 2}" y="${H - 6}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(input.xLabel)}</text>`;
  }

  svg += `</svg>`;
  return svg;
}
