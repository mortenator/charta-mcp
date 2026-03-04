import { ChartInput, ThemeColors, getTheme } from "../types.js";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

export function generateBarChart(input: ChartInput): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 600;
  const H = input.style?.height ?? 400;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showValues = input.style?.showValues !== false;
  const showGrid = input.style?.showGrid !== false;

  const padTop = input.title ? 50 : 20;
  const padBottom = 55;
  const padLeft = 60;
  const padRight = 20;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const values = input.data.map((d) => d.value ?? 0);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  // Nice axis
  const niceMax = niceNumber(maxVal, minVal);
  const niceMin = minVal < 0 ? -niceNumber(Math.abs(minVal), 0) : 0;
  const niceRange = niceMax - niceMin;

  const n = input.data.length;
  const groupW = chartW / n;
  const barPad = Math.max(4, groupW * 0.2);
  const barW = groupW - barPad;

  const yScale = (v: number) => chartH - ((v - niceMin) / niceRange) * chartH;
  const zeroY = yScale(0);

  const gridLines = 5;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  // Title
  if (input.title) {
    svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  // Grid lines
  if (showGrid) {
    for (let i = 0; i <= gridLines; i++) {
      const v = niceMin + (niceRange * i) / gridLines;
      const y = padTop + yScale(v);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
  }

  // Zero line
  if (niceMin < 0) {
    const y = padTop + zeroY;
    svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.border}" stroke-width="1.5"/>`;
  }

  // Bars
  input.data.forEach((d, i) => {
    const val = d.value ?? 0;
    const barColor = d.color ?? theme.palette[i % theme.palette.length];
    const x = padLeft + i * groupW + barPad / 2;
    const barH = Math.abs(((val - 0) / niceRange) * chartH);
    const y = padTop + (val >= 0 ? yScale(val) : zeroY);

    svg += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 1)}" fill="${barColor}" rx="3"/>`;

    // Value label
    if (showValues) {
      const labelY = val >= 0 ? y - 5 : y + barH + 13;
      svg += `<text x="${x + barW / 2}" y="${labelY}" text-anchor="middle" fill="${theme.text}" font-size="11" font-weight="500">${fmt(val)}</text>`;
    }

    // X label
    const labelText = truncate(d.label, 10);
    svg += `<text x="${x + barW / 2}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(labelText)}</text>`;
  });

  // Y axis label
  if (input.yLabel) {
    svg += `<text x="${14}" y="${padTop + chartH / 2}" text-anchor="middle" fill="${theme.subtext}" font-size="11" transform="rotate(-90, 14, ${padTop + chartH / 2})">${esc(input.yLabel)}</text>`;
  }

  // X axis label
  if (input.xLabel) {
    svg += `<text x="${padLeft + chartW / 2}" y="${H - 6}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(input.xLabel)}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

export function generateGroupedBarChart(input: ChartInput): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 640;
  const H = input.style?.height ?? 420;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showValues = input.style?.showValues ?? false;
  const showGrid = input.style?.showGrid !== false;
  const showLegend = input.style?.showLegend !== false;

  const legendH = showLegend ? 30 : 0;
  const padTop = input.title ? 50 : 20;
  const padBottom = 55 + legendH;
  const padLeft = 60;
  const padRight = 20;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  // Determine number of series
  const seriesCount = Math.max(...input.data.map((d) => d.values?.length ?? 0));
  const allValues = input.data.flatMap((d) => d.values ?? []);
  const maxVal = Math.max(...allValues, 0);
  const minVal = Math.min(...allValues, 0);

  const niceMax = niceNumber(maxVal, minVal);
  const niceMin = minVal < 0 ? -niceNumber(Math.abs(minVal), 0) : 0;
  const niceRange = niceMax - niceMin;

  const n = input.data.length;
  const groupW = chartW / n;
  const groupPad = Math.max(4, groupW * 0.15);
  const innerW = groupW - groupPad;
  const barW = innerW / seriesCount - 2;

  const yScale = (v: number) => chartH - ((v - niceMin) / niceRange) * chartH;
  const zeroY = yScale(0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  if (input.title) {
    svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  if (showGrid) {
    for (let i = 0; i <= 5; i++) {
      const v = niceMin + (niceRange * i) / 5;
      const y = padTop + yScale(v);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
  }

  input.data.forEach((d, i) => {
    const groupX = padLeft + i * groupW + groupPad / 2;
    (d.values ?? []).forEach((val, s) => {
      const barColor = theme.palette[s % theme.palette.length];
      const x = groupX + s * (barW + 2);
      const barH = Math.abs(((val - 0) / niceRange) * chartH);
      const y = padTop + (val >= 0 ? yScale(val) : zeroY);
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 1)}" fill="${barColor}" rx="2"/>`;
      if (showValues) {
        const lY = val >= 0 ? y - 4 : y + barH + 12;
        svg += `<text x="${x + barW / 2}" y="${lY}" text-anchor="middle" fill="${theme.text}" font-size="9">${fmt(val)}</text>`;
      }
    });
    const labelText = truncate(d.label, 10);
    svg += `<text x="${groupX + innerW / 2}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(labelText)}</text>`;
  });

  // Legend
  if (showLegend && (input as any).seriesLabels) {
    const labels: string[] = (input as any).seriesLabels;
    const legendY = H - legendH + 8;
    let lx = padLeft;
    labels.forEach((label, s) => {
      const c = theme.palette[s % theme.palette.length];
      svg += `<rect x="${lx}" y="${legendY}" width="10" height="10" fill="${c}" rx="2"/>`;
      svg += `<text x="${lx + 14}" y="${legendY + 9}" fill="${theme.subtext}" font-size="11">${esc(label)}</text>`;
      lx += label.length * 7 + 30;
    });
  }

  svg += `</svg>`;
  return svg;
}

export function generateStackedBarChart(input: ChartInput): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 640;
  const H = input.style?.height ?? 420;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showGrid = input.style?.showGrid !== false;
  const showLegend = input.style?.showLegend !== false;

  const legendH = showLegend ? 30 : 0;
  const padTop = input.title ? 50 : 20;
  const padBottom = 55 + legendH;
  const padLeft = 60;
  const padRight = 20;

  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const totals = input.data.map((d) => (d.values ?? []).reduce((a, b) => a + b, 0));
  const maxVal = Math.max(...totals, 0);
  const niceMax = niceNumber(maxVal, 0);

  const n = input.data.length;
  const groupW = chartW / n;
  const barPad = Math.max(4, groupW * 0.2);
  const barW = groupW - barPad;

  const yScale = (v: number) => chartH * (1 - v / niceMax);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  if (input.title) {
    svg += `<text x="${W / 2}" y="28" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  if (showGrid) {
    for (let i = 0; i <= 5; i++) {
      const v = (niceMax * i) / 5;
      const y = padTop + yScale(v);
      svg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="${theme.grid}" stroke-width="1"/>`;
      svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="${theme.subtext}" font-size="11">${fmt(v)}</text>`;
    }
  }

  input.data.forEach((d, i) => {
    const x = padLeft + i * groupW + barPad / 2;
    let cumulative = 0;
    (d.values ?? []).forEach((val, s) => {
      const barColor = theme.palette[s % theme.palette.length];
      const segH = (val / niceMax) * chartH;
      const y = padTop + yScale(cumulative + val);
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(segH, 1)}" fill="${barColor}" rx="${s === 0 ? "0 0 3 3" : s === (d.values!.length - 1) ? "3 3 0 0" : "0"}"/>`;
      cumulative += val;
    });
    const labelText = truncate(d.label, 10);
    svg += `<text x="${x + barW / 2}" y="${H - padBottom + 18}" text-anchor="middle" fill="${theme.subtext}" font-size="11">${esc(labelText)}</text>`;
  });

  if (showLegend && (input as any).seriesLabels) {
    const labels: string[] = (input as any).seriesLabels;
    const legendY = H - legendH + 8;
    let lx = padLeft;
    labels.forEach((label, s) => {
      const c = theme.palette[s % theme.palette.length];
      svg += `<rect x="${lx}" y="${legendY}" width="10" height="10" fill="${c}" rx="2"/>`;
      svg += `<text x="${lx + 14}" y="${legendY + 9}" fill="${theme.subtext}" font-size="11">${esc(label)}</text>`;
      lx += label.length * 7 + 30;
    });
  }

  svg += `</svg>`;
  return svg;
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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
