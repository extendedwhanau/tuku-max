/**
 * Geometric Tukutuku pattern generators.
 * Each returns a 2D array of palette indices (0+) or null.
 */

function empty(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
}

function set(grid, r, c, colour) {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return;
  grid[r][c] = colour;
}

/**
 * Kaokao — chevron / zigzag bands repeating up the panel.
 * 45° diagonals, thickness ≈ gap, peaks pointing up.
 */
function kaokao(rows, cols) {
  const g = empty(rows, cols);
  const thick = Math.max(3, Math.round(Math.min(rows, cols) / 14));
  const halfZig = Math.max(thick * 2, Math.round(cols / 6));
  const period = halfZig * 2;
  const pitch = thick * 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const phase = ((c % period) + period) % period;
      // 0 at peak, halfZig at valley — arms step down 1 row per column
      const tri = phase <= halfZig ? phase : period - phase;
      const dist = ((r - tri) % pitch + pitch) % pitch;
      if (dist < thick) set(g, r, c, 0);
    }
  }
  return g;
}

/**
 * One thick stair strand: vertical up, then horizontal right, repeat.
 * (r, c) is the bottom-left of the current vertical segment.
 * t = path thickness, seg = length of each straight (incl. corner).
 */
function walkPoutamaStrand(g, rows, cols, r0, c0, t, seg, colour) {
  let r = r0;
  let c = c0;
  const steps = Math.ceil((rows + cols) / Math.max(1, seg - t)) + 3;

  for (let n = 0; n < steps; n++) {
    if (c > cols + seg && r < -seg) break;
    if (r > rows + seg && c < -seg) break;

    // Vertical segment going up (decreasing row)
    for (let i = 0; i < seg; i++) {
      for (let k = 0; k < t; k++) {
        set(g, r - i, c + k, colour);
      }
    }

    // Horizontal segment at the top of that vertical, going right
    const topR = r - seg + 1;
    for (let i = 0; i < seg; i++) {
      for (let k = 0; k < t; k++) {
        set(g, topR + k, c + i, colour);
      }
    }

    // Next vertical starts at the right end of the horizontal bar
    r = topR + t - 1;
    c = c + seg - t;
  }
}

/**
 * Single Poutama — parallel thick stair paths climbing up / right.
 * Thickness and gap match (classic interlocking strands).
 */
function poutama(rows, cols) {
  const g = empty(rows, cols);
  const t = Math.max(3, Math.round(Math.min(rows, cols) / 16));
  const seg = t * 3;
  const pitch = t * 2;

  // Offset along (r, c) = (1, 1), perpendicular to the up-right travel,
  // so strands run parallel and nest instead of stacking into solid bars.
  const n = Math.ceil((rows + cols) / pitch) + 2;
  for (let k = -n; k <= n; k++) {
    walkPoutamaStrand(g, rows, cols, rows - 1 + k * pitch, k * pitch, t, seg, 0);
  }
  return g;
}

/**
 * Double Poutama — single poutama grown from the centre out, mirrored.
 * Stairs climb into the centre on both sides (same strand language as poutama).
 */
function doublePoutama(rows, cols) {
  const g = empty(rows, cols);
  const mid = Math.floor((cols - 1) / 2);
  const halfW = Math.max(mid + 1, cols - mid);

  // Same pattern as single poutama, sized to one half
  const half = poutama(rows, halfW);

  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < halfW; x++) {
      // Grow from centre (x=0) outward; flip so strands climb into the centre
      const v = half[r][halfW - 1 - x];
      if (v == null) continue;
      const right = mid + x;
      const left = mid - x;
      if (right < cols) set(g, r, right, v);
      if (left >= 0) set(g, r, left, v);
    }
  }
  return g;
}

/**
 * One pātiki diamond in local coords (pr, pc) relative to centre.
 * Classic tukutuku flounder:
 *  - double diamond rim
 *  - single centre stitch with a clear moat
 *  - four triangular lobes at N/S/E/W, inset from the rim,
 *    tips toward the corners (1·3·5·7), bases facing the moat
 */
export function isPatikiDiamond(pr, pc, size) {
  const d = Math.abs(pr) + Math.abs(pc);
  if (d > size) return false;

  if (pr === 0 && pc === 0) return true;
  if (d === size || d === size - 1) return true;

  // Inset tips so lobes sit inside the rim, not merged into it
  const tip = size - 3;
  // Fixed depth keeps the four triangles readable as separate forms
  const depth = Math.min(4, Math.max(3, tip - 2));
  const maxI = depth - 1;

  if (pr >= -tip && pr <= -tip + maxI && Math.abs(pc) <= pr - (-tip)) return true;
  if (pr <= tip && pr >= tip - maxI && Math.abs(pc) <= tip - pr) return true;
  if (pc >= -tip && pc <= -tip + maxI && Math.abs(pr) <= pc - (-tip)) return true;
  if (pc <= tip && pc >= tip - maxI && Math.abs(pr) <= tip - pc) return true;
  return false;
}

/** Pātiki — repeating diamonds with centre triangles */
function patiki(rows, cols) {
  const g = empty(rows, cols);
  const size = Math.max(9, Math.round(Math.min(rows, cols) / 3));
  const period = size * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pr = ((r % period) - size + period) % period - size;
      const pc = ((c % period) - size + period) % period - size;
      if (isPatikiDiamond(pr, pc, size)) set(g, r, c, 0);
    }
  }
  return g;
}

/**
 * Large Pātiki — empty centre, concentric diamond rings.
 * Ring + gap must be wider than 1/1 or manhattan odds collapse
 * into a checkerboard and stop reading as diamonds.
 */
function largePatiki(rows, cols) {
  const g = empty(rows, cols);
  const midR = Math.floor((rows - 1) / 2);
  const midC = Math.floor((cols - 1) / 2);
  // 1-cell ring, 2-cell gap — same look as the working randomise form
  const step = 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.abs(r - midR) + Math.abs(c - midC);
      if (d > 0 && d % step === 1) set(g, r, c, 0);
    }
  }
  return g;
}

/**
 * Niho Taniwha — bands of sharp cut triangles with a gutter between teeth.
 */
function niho(rows, cols) {
  const g = empty(rows, cols);
  const nTeeth = Math.max(3, Math.round(cols / 5));
  const toothW = Math.max(4, Math.floor(cols / nTeeth));
  const toothH = Math.max(4, Math.round(toothW * 0.85));
  const pitch = toothH + 1; // empty row between bands
  const gutter = 1; // empty column between teeth

  for (let band = 0; band * pitch < rows; band++) {
    const flip = band % 2 === 1;
    for (let t = 0; t < nTeeth; t++) {
      const baseC = t * toothW;
      const innerW = toothW - gutter;
      if (innerW < 2) continue;
      const tipC = baseC + Math.floor((innerW - 1) / 2);

      for (let i = 0; i < toothH; i++) {
        const r = band * pitch + (flip ? toothH - 1 - i : i);
        if (r < 0 || r >= rows) continue;

        const span = 1 + Math.round((i / Math.max(1, toothH - 1)) * (innerW - 1));
        const left = tipC - Math.floor((span - 1) / 2);
        const right = left + span - 1;

        for (let c = left; c <= right; c++) {
          if (c < baseC || c >= baseC + innerW) continue;
          if (c < 0 || c >= cols) continue;
          set(g, r, c, 0);
        }
      }
    }
  }
  return g;
}

/** Full grid — every cell has a stitch */
function full(rows, cols) {
  const g = empty(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) set(g, r, c, 0);
  }
  return g;
}

const GENERATORS = {
  empty: (rows, cols) => empty(rows, cols),
  kaokao,
  poutama,
  doublePoutama,
  patiki,
  largePatiki,
  niho,
  full,
};

/**
 * Build a binary mask (stitch on/off). Multi-colour pattern values collapse to on.
 */
export function generatePattern(name, rows, cols) {
  const fn = GENERATORS[name] || GENERATORS.empty;
  const raw = fn(rows, cols);
  return raw.map((row) => row.map((v) => (v == null ? null : 0)));
}

export const PRESET_LABELS = Object.keys(GENERATORS);
