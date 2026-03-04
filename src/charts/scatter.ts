import { ChartInput, getTheme } from "../types.js";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function niceNumber(max: number): number {
  if (max <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const fraction = max / magnitude;
  let nice: number;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return Math.ceil(max / (nice * magnitude)) * nice * magnitude;
}

export function generateScatterChart(input: ChartInput): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 600;
  const H = input.style?.height ?? 420;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showGrid = input.style?.showGrid !== false;
  const isBubble = input.type === "bubble";

  const padTop = input.title ? 50 : 20;
  const padBottom = 55;
  const padLeft = 65;
  const padRight = 30;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const xs = input.data.map((d) => d.x ?? 0);
  const ys = input.data.map((d) => d.y ?? 0);
  const sizes = isBubble ? input.data.map((d) => d.size ?? 20) : [];

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 0);

  const xRange = xMax - xMin || 1;
  const xPad = xRange * 0.1;
  const xAxisMin = xMin - xPad;
  const xAxisMax = xMax + xPad;

  const niceYMax = niceNumber(yMax);
  const niceYMin = yMin < 0 ? -niceNumber(Math.abs(yMin)) : 0;
  const yRange = niceYMax - niceYMin;

  const maxSize = isBubble ? Math.max(...sizes) : 1;
  const minBubbleR = 6;
  const maxBubbleR = Math.min(chartW, chartH) * 0.1;

  const xPx = (v: number) => padLeft + ((v - xAxisMin) / (xAxisMax - xAxisMin)) * chartW;
  const yPx = (v: number) => padTop + chartH * (1 - (v - niceYMin) / yRange);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  if (input.title) {
    svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  // Grid
  if (showGrid) {
    for (let i = 0; i <= 5; i++) {
      const v = niceYMin + (yRange * i) / 5;
      const y = yPx(v);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
    for (let i = 0; i <= 5; i++) {
      const v = xAxisMin + ((xAxisMax - xAxisMin) * i) / 5;
      const x = xPx(v);
      svg += `<line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${padTop + chartH + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
  }

  // Zero lines
  if (niceYMin < 0) {
    const y = yPx(0);
    svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.border}" stroke-width="1.5"/>`;
  }

  // Points
  input.data.forEach((d, i) => {
    const x = xPx(d.x ?? 0);
    const y = yPx(d.y ?? 0);
    const color = theme.palette[i % theme.palette.length];
    let pointR: number;

    if (isBubble) {
      const sz = d.size ?? 20;
      pointR = minBubbleR + ((sz / maxSize) * (maxBubbleR - minBubbleR));
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${pointR.toFixed(1)}" fill="${color}" opacity="0.75" stroke="${theme.background}" stroke-width="1"/>`;
    } else {
      pointR = 5;
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${pointR}" fill="${color}" stroke="${theme.background}" stroke-width="1.5"/>`;
    }

    // Label
    if (d.label && input.data.length <= 20) {
      svg += `<text x="${(x + pointR + 3).toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="${theme.subtext}" font-size="10">${esc(d.label)}</text>`;
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
