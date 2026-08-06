/**
 * SVG export — canvas-sized artboard.
 */

import { S } from "./state.js";
import { unitsToSVG } from "./shapes.js";

export function exportSVG(metrics) {
  if (!metrics) return;

  const W = S.canvasW;
  const H = S.canvasH;
  const c = metrics.content;
  const ox = (W - c.width) / 2 - c.minX + S.panX;
  const oy = (H - c.height) / 2 - c.minY + S.panY;

  // Temporarily offset dots for SVG in canvas space
  const shifted = {
    ...metrics,
    dots: metrics.dots.map((d) => ({ ...d, x: d.x + ox, y: d.y + oy })),
  };

  const body = unitsToSVG(shifted);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${S.bg}"/>
  <g>
${body}
  </g>
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gtl-${S.shape}-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
