/**
 * Central state — Jum Young Lee Dot Font model:
 * canvasW/H, fontSizePct (% of canvas width),
 * shapeSize + gap → step = size + gap (absolute px, independent of font).
 */

export const S = {
  text: "H",
  canvasW: 1200,
  canvasH: 800,
  ratio: "free", // free | 1:1 | 9:16 | 4:5 | 16:9
  fitPadding: 8, // % padding when fitting

  fontFamily: "GTLFont",
  fontName: "Source Sans 3",
  fontSizePct: 42, // % of canvas width
  tracking: 0, // em-ish px added per glyph gap at current size
  lineH: 1.1,
  align: "center",

  // Grid — absolute canvas pixels (NOT coupled to font size)
  shapeSize: 10,
  gap: 4,
  pattern: "grid", // grid | checker | vertical | horizontal
  threshold: 110, // alpha threshold 0–255

  shape: "niho",
  direction: "horizontal-in",
  elongation: 1.6,
  round: 0,
  sx: 1,
  sy: 1,

  bg: "#000000",
  fg: "#ffffff",
  showFrame: true,
  showGrid: false,

  // motion
  motion: "none", // none | pulse | wave
  speed: 1,

  panX: 0,
  panY: 0,
};

export function fontPx() {
  return Math.max(8, (S.canvasW * S.fontSizePct) / 100);
}

/** Grid step in canvas pixels. Shape size and gap are independent of type size. */
export function gridStep() {
  return Math.max(1, Math.round(S.shapeSize + S.gap));
}

/** Half-extents of each unit. Gap 0 → fill the cell. */
export function unitRadius() {
  const step = gridStep();
  if (S.gap <= 0) {
    return {
      rx: (step / 2) * S.sx,
      ry: (step / 2) * S.sy,
    };
  }
  return {
    rx: (S.shapeSize / 2) * S.sx,
    ry: (S.shapeSize / 2) * S.sy,
  };
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
