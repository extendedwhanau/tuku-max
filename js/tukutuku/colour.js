/**
 * Colour treatments applied on top of a pattern mask.
 * Mask: non-null = stitch. Output: hex string or null.
 */

/** Named geometric colour fills (also used by Randomise geometric). */
export const GEO_OPTIONS = [
  { id: "stripes-h", label: "Horizontal stripes" },
  { id: "stripes-v", label: "Vertical stripes" },
  { id: "diag", label: "Diagonal" },
  { id: "diag-alt", label: "Diagonal alt" },
  { id: "rings", label: "Rings" },
  { id: "diamonds", label: "Diamonds" },
  { id: "blocks", label: "Blocks" },
  { id: "waves", label: "Waves" },
  { id: "spiral", label: "Spiral" },
  { id: "chevrons", label: "Chevrons" },
  { id: "grid", label: "Grid" },
  { id: "noise", label: "Noise" },
];

export const GEO_KINDS = GEO_OPTIONS.map((o) => o.id);

export function geoLabel(kind) {
  return GEO_OPTIONS.find((o) => o.id === kind)?.label || kind;
}

function hash2(r, c, seed = 0) {
  const n = Math.sin((r + seed * 0.17) * 127.1 + (c + seed * 0.31) * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function parseHex(hex) {
  const h = String(hex).replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function toHex({ r, g, b }) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  const u = Math.max(0, Math.min(1, t));
  const s = u * u * (3 - 2 * u);
  return toHex({
    r: lerp(A.r, B.r, s),
    g: lerp(A.g, B.g, s),
    b: lerp(A.b, B.b, s),
  });
}

/** Continuous field for geo kinds. */
function geoField(r, c, rows, cols, kind, seed) {
  const s = seed;
  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;

  switch (kind) {
    case "stripes-h":
      return (r + s) / 3;
    case "stripes-v":
      return (c + s) / 3;
    case "diag":
      return (r + c + s) / 4;
    case "diag-alt":
      return (r - c + s) / 4;
    case "rings":
      return Math.hypot(r - midR, c - midC) / 3 + s;
    case "diamonds":
      return (Math.abs(r - midR) + Math.abs(c - midC)) / 3 + s;
    case "blocks":
      return r / 4 + c / 4 + s;
    case "waves":
      return r / 2 + Math.sin((c + s) * 0.45) * 3.2 + s;
    case "spiral": {
      const ang = Math.atan2(r - midR, c - midC);
      const d = Math.hypot(r - midR, c - midC);
      return (ang * 2.5 + d * 0.35 + s * 0.2) / Math.PI;
    }
    case "chevrons": {
      const period = 14;
      const phase = ((c + s) % period + period) % period;
      const tri = phase <= period / 2 ? phase : period - phase;
      return (r + tri) / 3 + s;
    }
    case "grid":
      return r / 2 + c / 2 + s;
    case "noise":
      return hash2(r, c, Math.floor(s * 10)) * 2 + s;
    default:
      return (r + c + s) / 4;
  }
}

function geoColour(r, c, rows, cols, kind, seed, colourA, colourB, smooth) {
  const field = geoField(r, c, rows, cols, kind, seed);
  if (smooth) {
    const t = 0.5 + 0.5 * Math.sin(field * Math.PI);
    return lerpHex(colourA, colourB, t);
  }
  return Math.floor(field) % 2 === 0 ? colourA : colourB;
}

/**
 * Colour for one stitch. Pass phase.smooth for animated blends.
 * @param {{ dr?: number, dc?: number, t?: number, smooth?: boolean }} [phase]
 */
export function colourAt(r, c, rows, cols, mode, colourA, colourB, geo = {}, phase = {}) {
  const dr = phase.dr ?? 0;
  const dc = phase.dc ?? 0;
  const tt = phase.t ?? 0;
  const smooth = phase.smooth === true;
  const rr = r + dr;
  const cc = c + dc;
  const kind = geo.kind || "diag";
  const seed = (geo.seed ?? 0) + tt;

  if (mode === "mumu") {
    if (smooth) {
      const t = 0.5 + 0.5 * Math.sin((rr + cc) * Math.PI);
      return lerpHex(colourA, colourB, t);
    }
    return Math.round(rr + cc) % 2 === 0 ? colourA : colourB;
  }

  if (mode === "purapura") {
    if (smooth) {
      const h = hash2(r, c, 7);
      const twinkle = 0.5 + 0.5 * Math.sin(tt * 0.55 + h * 28);
      const star = h > 0.7 ? 0.35 + twinkle * 0.65 : h * 0.12;
      return lerpHex(colourA, colourB, Math.min(1, star));
    }
    const h = hash2(r, c, 7 + tt * 0.15);
    const h2 = hash2(r * 3, c * 5, 19 + tt);
    const h3 = hash2(Math.floor(r / 5), Math.floor(c / 5), 3);
    if (h3 > 0.82 && h > 0.5) return colourB;
    if (h > 0.91) return colourB;
    if (h > 0.84 && h2 > 0.35) return colourB;
    if (h > 0.76 && (r + c + Math.floor(tt)) % 3 === 0) return colourB;
    if (h2 > 0.96) return colourB;
    return colourA;
  }

  if (mode === "geo") {
    return geoColour(rr, cc, rows, cols, kind, seed, colourA, colourB, smooth);
  }

  if (smooth) {
    const t = 0.5 + 0.5 * Math.sin(tt * 0.4 + (r + c) * 0.04);
    return lerpHex(colourA, colourB, t * 0.3);
  }
  return colourA;
}

export function colourize(mask, mode, colourA, colourB, geo = {}) {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const out = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] == null) continue;
      out[r][c] = colourAt(r, c, rows, cols, mode, colourA, colourB, geo);
    }
  }
  return out;
}

/** Contemporary A/B pairs — pastel, bright, and graphic duotones. */
const FUN_PALETTES = [
  // Pastel
  ["#f4e9e1", "#c4a4c8"],
  ["#e8f0e6", "#a8c5c7"],
  ["#f7e8ee", "#9bb7d4"],
  ["#f3efe6", "#d4b5a0"],
  ["#eef2f7", "#b8a9d9"],
  ["#f6f0e4", "#e8b4b8"],
  ["#e6f2ef", "#c5d4a8"],
  ["#f5ebe3", "#8fadc4"],
  ["#f0eef8", "#d9c4e8"],
  ["#faf6ef", "#b5c9b0"],
  // Soft + deep
  ["#f7f2ea", "#2f3a4a"],
  ["#f3ebe4", "#4a3f55"],
  ["#eef5f2", "#1f4d4a"],
  ["#f8f1e9", "#5c3d4a"],
  ["#f2f4f7", "#243447"],
  ["#f6efe8", "#3d4a2f"],
  // Bright contemporary
  ["#fff5e8", "#ff5a36"],
  ["#f0f7ff", "#2b6cff"],
  ["#fff0f5", "#ff2d7b"],
  ["#f4fff0", "#00c46a"],
  ["#fff8e6", "#ffb000"],
  ["#f5f0ff", "#7a3cff"],
  ["#e8fffb", "#00b7c2"],
  ["#fff2e8", "#ff6b2c"],
  ["#f0fff4", "#12d18e"],
  ["#fff0fa", "#e11d74"],
  // Graphic duotones
  ["#f5f5f0", "#0a0a0a"],
  ["#ffffff", "#1a1a2e"],
  ["#f8f4ec", "#0d3b66"],
  ["#fafafa", "#e63946"],
  ["#f4f1ea", "#457b9d"],
  ["#fefae0", "#283618"],
  ["#edf2f4", "#ef233c"],
  ["#f1faee", "#1d3557"],
  ["#fdf0d5", "#003049"],
  ["#eae4e9", "#3d348b"],
  // Unexpected modern mixes
  ["#ffe5ec", "#00a896"],
  ["#e0fbfc", "#ee6c4d"],
  ["#fef3c7", "#5b21b6"],
  ["#dbeafe", "#f97316"],
  ["#fce7f3", "#0f766e"],
  ["#ecfccb", "#7c3aed"],
  ["#ffe4e6", "#0369a1"],
  ["#fef9c3", "#be185d"],
  ["#ccfbf1", "#c2410c"],
  ["#ede9fe", "#15803d"],
];

/** Extra singles for procedural pairs when we want fresh combos. */
const MODERN_LIGHTS = [
  "#faf7f2",
  "#f5f0eb",
  "#eef2f7",
  "#f7f2f8",
  "#f0f7f4",
  "#fff8f0",
  "#f4f8fb",
  "#faf5f0",
  "#f2f5f0",
  "#fff5f7",
];

const MODERN_ACCENTS = [
  "#ff4d6d",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#06b6d4",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#0ea5e9",
  "#d946ef",
  "#64748b",
  "#1e293b",
  "#334155",
  "#7c3aed",
  "#e11d48",
  "#0f766e",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomColourPair() {
  // Mostly curated pairs; sometimes a fresh light + accent mix
  if (Math.random() < 0.7) {
    const [a, b] = pick(FUN_PALETTES);
    return Math.random() > 0.5 ? [a, b] : [b, a];
  }
  const light = pick(MODERN_LIGHTS);
  const accent = pick(MODERN_ACCENTS);
  return Math.random() > 0.15 ? [light, accent] : [accent, light];
}

export function randomiseGeo(twiddleColours = true) {
  const kind = GEO_KINDS[Math.floor(Math.random() * GEO_KINDS.length)];
  const seed = Math.floor(Math.random() * 1000);
  const result = { kind, seed, colourMode: "geo" };
  if (twiddleColours) {
    const [a, b] = randomColourPair();
    result.colourA = a;
    result.colourB = b;
  }
  return result;
}
