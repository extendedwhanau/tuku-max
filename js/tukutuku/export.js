/**
 * Export clean SVG / PNG from board state (no hit targets).
 */

import { S, boardWidth, boardHeight } from "./state.js";
import { stitchSymbolSVG, letterAt } from "./symbol.js";

export function buildCleanSVG() {
  const W = boardWidth();
  const H = boardHeight();
  const {
    cols,
    rows,
    cell,
    gap,
    stroke,
    cells,
    symbol,
    symbolRotation,
    customSvg,
    symbolWord,
  } = S;

  let stitches = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hex = cells[r]?.[c];
      if (!hex) continue;
      const x = c * cell;
      const y = r * (cell + gap);
      const mark = stitchSymbolSVG({
        size: cell,
        stroke,
        hex,
        symbol,
        rotation: symbolRotation,
        custom: customSvg,
        letter: letterAt(r, c, cols, symbolWord),
      });
      stitches += `<g transform="translate(${x} ${y})">${mark}</g>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <g id="stitches">
${stitches}  </g>
</svg>`;
}

export function downloadSVG() {
  const svg = buildCleanSVG();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tukutuku-${S.cols}x${S.rows}-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPNG() {
  const svg = buildCleanSVG();
  const W = boardWidth();
  const H = boardHeight();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const u = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = u;
      a.download = `tukutuku-${S.cols}x${S.rows}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(u);
    }, "image/png");
  };
  img.src = url;
}
