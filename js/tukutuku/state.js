/**
 * Tukutuku board state — X stitch grid.
 */

export const S = {
  /** Derived from viewport ÷ cell */
  cols: 24,
  rows: 48,
  cell: 14,
  gap: 1.5,
  stroke: 1.6,
  /** Portion of the stage the board fills (40–100) */
  boardW: 100,
  boardH: 100,
  colourA: "#f5f0e6",
  colourB: "#a52a2a",
  /** solid | mumu | purapura | geo */
  colourMode: "solid",
  geoKind: "diag",
  geoSeed: 0,
  /** x | circle | triangle | square | custom | text */
  symbol: "x",
  symbolRotation: 0,
  /** Word tiled across cells when symbol is text */
  symbolWord: "RONGO",
  /** Typeface for text stitches — Die Grotesk by default */
  typefaceName: "Die Grotesk A",
  typefaceFamily: "Die Grotesk A",
  /** @type {string|null} data URI for custom / export embed */
  typefaceDataUri: null,
  /** @type {string|null} woff2 | woff | opentype | truetype */
  typefaceFormat: null,
  /** @type {{ markup: string, viewBox: { x: number, y: number, w: number, h: number }, name: string } | null} */
  customSvg: null,
  preset: "kaokao",
  patternLabel: "Kaokao",
  /** none | pulse | shimmer | wave | ripple */
  motion: "none",
  /** none | scroll | scroll-v | drift | sweep | breathe | flicker | tide */
  colourMotion: "none",
  speed: 1,
  /** @type {(string|null)[][]|null} binary mask before colour */
  mask: null,
  /** @type {(string|null)[][]} cells[row][col] = hex | null */
  cells: [],
};

export function ensureGrid() {
  const { rows, cols } = S;
  S.cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (S.cells[r] && c < S.cells[r].length) return S.cells[r][c];
      return null;
    })
  );
}

export function boardWidth() {
  return S.cols * S.cell;
}

export function boardHeight() {
  return S.rows * (S.cell + S.gap) - S.gap;
}

/**
 * Fit cols/rows so the board fills a target pixel area at the current cell size.
 * @returns {boolean} true if cols/rows changed
 */
export function fitGridToSize(targetW, targetH) {
  const cell = Math.max(7, S.cell);
  const gap = Math.max(0, S.gap);
  const cols = Math.max(4, Math.floor(targetW / cell));
  const rows = Math.max(4, Math.floor((targetH + gap) / (cell + gap)));
  const changed = cols !== S.cols || rows !== S.rows;
  S.cols = cols;
  S.rows = rows;
  return changed;
}

ensureGrid();
