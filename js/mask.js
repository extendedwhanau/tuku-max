/**
 * Raster mask + pixel-grid sampling (Jum Young Lee approach).
 * Render text → read alpha → place units on step lattice.
 */

import { S, fontPx, gridStep, unitRadius, clamp } from "./state.js";
import { fontCSS } from "./fonts.js";

function wrapLines(ctx, text, maxWidth) {
  const raw = String(text || " ").replace(/\r/g, "").split("\n");
  const out = [];
  for (const paragraph of raw) {
    if (paragraph === "") {
      out.push("");
      continue;
    }
    const words = paragraph.split(/(\s+)/);
    let line = "";
    for (const w of words) {
      if (!w) continue;
      const trial = line + w;
      if (line && ctx.measureText(trial).width > maxWidth) {
        out.push(line.replace(/\s+$/, ""));
        line = w.replace(/^\s+/, "");
        while (line && ctx.measureText(line).width > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        line = trial;
      }
    }
    out.push(line.replace(/\s+$/, ""));
  }
  return out.length ? out : [""];
}

function cellEnabled(pattern, row, col) {
  if (pattern === "checker") return (row + col) % 2 === 0;
  if (pattern === "vertical") return col % 2 === 0;
  if (pattern === "horizontal") return row % 2 === 0;
  return true;
}

/**
 * Build sampled units. Returns metrics for drawing/export.
 */
export function buildMetrics() {
  const fs = fontPx();
  const step = gridStep();
  const { rx, ry } = unitRadius();
  const lines = String(S.text || "").replace(/\r/g, "").split("\n");

  // Offscreen raster large enough for text
  const pad = Math.max(48, step * 4);
  const off = document.createElement("canvas");
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return null;

  octx.font = `${fs}px ${fontCSS()}`;
  // Estimate wrap width from canvas content area
  const contentW = Math.max(40, S.canvasW * (1 - (S.fitPadding * 2) / 100));
  const wrapped = wrapLines(octx, S.text, contentW);

  const lineHeight = fs * S.lineH;
  let maxLineW = 0;
  for (const ln of wrapped) {
    let w = octx.measureText(ln).width;
    if (S.tracking && ln.length > 1) w += S.tracking * (ln.length - 1);
    maxLineW = Math.max(maxLineW, w);
  }

  const textH = Math.max(lineHeight, wrapped.length * lineHeight);
  const rW = Math.ceil(Math.max(S.canvasW, maxLineW + pad * 2));
  const rH = Math.ceil(Math.max(S.canvasH, textH + pad * 2 + fs * 0.35));
  off.width = rW;
  off.height = rH;

  octx.clearRect(0, 0, rW, rH);
  octx.fillStyle = "#fff";
  octx.font = `${fs}px ${fontCSS()}`;
  octx.textBaseline = "alphabetic";
  octx.textAlign = "left";

  const blockW = maxLineW;
  const blockH = textH;
  const originX = (rW - blockW) / 2;
  const originY = (rH - blockH) / 2 + fs * 0.8;

  wrapped.forEach((ln, i) => {
    let x = originX;
    if (S.align === "center") {
      const w = octx.measureText(ln).width;
      x = (rW - w) / 2;
    } else if (S.align === "right") {
      const w = octx.measureText(ln).width;
      x = rW - pad - w;
    } else {
      x = pad;
    }
    const y = originY + i * lineHeight;
    if (S.tracking === 0) {
      octx.fillText(ln, x, y);
    } else {
      // Manual tracking
      let cx = x;
      for (const ch of ln) {
        octx.fillText(ch, cx, y);
        cx += octx.measureText(ch).width + S.tracking;
      }
    }
  });

  const img = octx.getImageData(0, 0, rW, rH).data;
  const dots = [];
  const st2 = step * 0.5;

  let row = 0;
  for (let gy = st2; gy < rH - st2; gy += step, row++) {
    let col = 0;
    for (let gx = st2; gx < rW - st2; gx += step, col++) {
      if (!cellEnabled(S.pattern, row, col)) continue;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const alpha = img[(iy * rW + ix) * 4 + 3] || 0;
      if (alpha < S.threshold) continue;
      dots.push({
        x: gx,
        y: gy,
        gx: col,
        gy: row,
        alpha,
      });
    }
  }

  // Content bounding box of dots
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const d of dots) {
    minX = Math.min(minX, d.x - rx);
    maxX = Math.max(maxX, d.x + rx);
    minY = Math.min(minY, d.y - ry);
    maxY = Math.max(maxY, d.y + ry);
  }
  if (!dots.length) {
    minX = 0;
    minY = 0;
    maxX = rW;
    maxY = rH;
  }

  return {
    dots,
    step,
    rx,
    ry,
    rasterW: rW,
    rasterH: rH,
    lines: wrapped,
    fontPx: fs,
    content: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}

/** Binary-search fontSizePct so content fits canvas with padding. */
export function fitTextToCanvas() {
  if (!String(S.text || "").trim()) return;
  const pad = clamp(S.fitPadding, 0, 40) / 100;
  const targetW = S.canvasW * (1 - pad * 2);
  const targetH = S.canvasH * (1 - pad * 2);

  let lo = 0.5;
  let hi = 120;
  let best = S.fontSizePct;
  const saved = S.fontSizePct;

  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    S.fontSizePct = mid;
    const m = buildMetrics();
    if (!m || !m.dots.length) {
      hi = mid;
      continue;
    }
    const ok = m.content.width <= targetW && m.content.height <= targetH;
    if (ok) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  S.fontSizePct = best || saved;
  return best;
}
