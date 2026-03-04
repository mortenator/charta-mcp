import { ChartInput, getTheme } from "../types.js";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  // Clamp to just under 360 to avoid degenerate full-circle arc
  const end = endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle;
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, end);
  const largeArc = end - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`;
}

function describeDonutArc(cx: number, cy: number, r: number, ir: number, startAngle: number, endAngle: number): string {
  const end = endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle;
  const s1 = polarToCartesian(cx, cy, r, startAngle);
  const e1 = polarToCartesian(cx, cy, r, end);
  const s2 = polarToCartesian(cx, cy, ir, end);
  const e2 = polarToCartesian(cx, cy, ir, startAngle);
  const largeArc = end - startAngle > 180 ? 1 : 0;
  return [
    `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${e1.x.toFixed(2)} ${e1.y.toFixed(2)}`,
    `L ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`,
    `A ${ir} ${ir} 0 ${largeArc} 0 ${e2.x.toFixed(2)} ${e2.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function buildPieOrDonut(input: ChartInput, isDonut: boolean): string {
  const theme = getTheme(input.style);
  const W = input.style?.width ?? 520;
  const H = input.style?.height ?? 400;
  const font = input.style?.fontFamily ?? "Inter, system-ui, sans-serif";
  const showLegend = input.style?.showLegend !== false;

  const legendH = showLegend ? Math.ceil(input.data.length / 2) * 22 + 10 : 0;
  const titleH = input.title ? 40 : 10;
  const availH = H - legendH - titleH;

  const cx = W / 2;
  const cy = titleH + availH / 2;
  const r = Math.min(W / 2, availH / 2) * 0.78;
  const ir = isDonut ? r * 0.52 : 0;

  const total = input.data.reduce((sum, d) => sum + (d.value ?? 0), 0);
  if (total <= 0) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${theme.background}"/><text x="${W/2}" y="${H/2}" text-anchor="middle" fill="${theme.subtext}" font-size="14">No data</text></svg>`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="font-family:${font}">`;
  svg += `<rect width="${W}" height="${H}" fill="${theme.background}" rx="8"/>`;

  if (input.title) {
    svg += `<text x="${W / 2}" y="26" text-anchor="middle" fill="${theme.text}" font-size="16" font-weight="600">${esc(input.title)}</text>`;
  }

  let currentAngle = 0;
  const slices = input.data.map((d, i) => {
    const pct = (d.value ?? 0) / total;
    const angle = pct * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...d, pct, startAngle, endAngle: currentAngle, color: d.color ?? theme.palette[i % theme.palette.length] };
  });

  // Draw slices
  slices.forEach((s) => {
    const path = isDonut
      ? describeDonutArc(cx, cy, r, ir, s.startAngle, s.endAngle)
      : describeArc(cx, cy, r, s.startAngle, s.endAngle);
    svg += `<path d="${path}" fill="${s.color}" stroke="${theme.background}" stroke-width="1.5"/>`;

    // Percentage label on slice (only if > 5%)
    if (s.pct > 0.05) {
      const midAngle = s.startAngle + (s.endAngle - s.startAngle) / 2;
      const labelR = isDonut ? (r + ir) / 2 : r * 0.6;
      const lp = polarToCartesian(cx, cy, labelR, midAngle);
      svg += `<text x="${lp.x.toFixed(1)}" y="${(lp.y + 4).toFixed(1)}" text-anchor="middle" fill="white" font-size="12" font-weight="600">${(s.pct * 100).toFixed(0)}%</text>`;
    }
  });

  // Donut center label (total)
  if (isDonut) {
    svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="${theme.text}" font-size="22" font-weight="700">${formatCenter(total)}</text>`;
    svg += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="${theme.subtext}" font-size="12">Total</text>`;
  }

  // Legend
  if (showLegend) {
    const cols = 2;
    const legendY = H - legendH + 12;
    const colW = W / cols;
    slices.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const lx = col * colW + 24;
      const ly = legendY + row * 22;
      svg += `<rect x="${lx}" y="${ly}" width="10" height="10" fill="${s.color}" rx="2"/>`;
      svg += `<text x="${lx + 14}" y="${ly + 9}" fill="${theme.subtext}" font-size="11">${esc(truncate(s.label, 18))} <tspan fill="${theme.text}" font-weight="500">${(s.pct * 100).toFixed(1)}%</tspan></text>`;
    });
  }

  svg += `</svg>`;
  return svg;
}

function formatCenter(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

export function generatePieChart(input: ChartInput): string {
  return buildPieOrDonut(input, false);
}

export function generateDonutChart(input: ChartInput): string {
  return buildPieOrDonut(input, true);
}
