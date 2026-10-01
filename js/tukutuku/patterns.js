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
 * Pātiki stitch at offset (dr, dc) from the pattern centre.
 * Concentric diamond rings radiate from a hollow centre following the rhythm.
 * Columns fold back every two rhythm repeats, so the diamonds repeat sideways
 * and the rings of neighbouring diamonds meet as a lattice.
 */
export function isPatikiStitch(dr, dc, rhythm = PATIKI_RHYTHM) {
  const fold = rhythmPeriod(rhythm) * 2;
  const u = ((dc % (fold * 2)) + fold * 2) % (fold * 2);
  const d = Math.min(u, fold * 2 - u) + Math.abs(dr);
  return ringOn(d, rhythm);
}

/** Classic pātiki rhythm — 3 gap, 3 stitch. */
export const PATIKI_RHYTHM = [3, 3];

function rhythmPeriod(rhythm) {
  return rhythm.reduce((a, b) => a + b, 0);
}

/**
 * Whether ring distance d is stitched. Rhythm alternates gap, stitch, gap,
 * stitch… widths, starting with the gap at the hollow centre, and repeats.
 */
function ringOn(d, rhythm) {
  let k = d % rhythmPeriod(rhythm);
  for (let i = 0; i < rhythm.length; i++) {
    if (k < rhythm[i]) return i % 2 === 1;
    k -= rhythm[i];
  }
  return false;
}

/**
 * Pātiki Offset stitch at (dr, dc) from a diamond centre.
 * Diamonds sit on a staggered lattice — each row of diamonds is shifted
 * half a step — and every stitch takes its rings from the nearest centre.
 */
export function isPatikiOffsetStitch(dr, dc, rhythm = PATIKI_RHYTHM) {
  const period = rhythmPeriod(rhythm);
  const stepC = period * 4 + 1;
  const stepR = period * 2 + 2;
  const shift = period * 2 + 1;
  const k0 = Math.round(dr / stepR);
  let d = Infinity;
  for (let k = k0 - 1; k <= k0 + 1; k++) {
    const offC = Math.abs(k) % 2 === 1 ? shift : 0;
    const j0 = Math.round((dc - offC) / stepC);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const dist = Math.abs(dr - k * stepR) + Math.abs(dc - offC - j * stepC);
      if (dist < d) d = dist;
    }
  }
  return ringOn(d, rhythm);
}

/** Pātiki Offset — staggered diamonds, rings meeting between them */
function patikiOffset(rows, cols) {
  const g = empty(rows, cols);
  const midR = Math.floor((rows - 1) / 2);
  const midC = Math.floor((cols - 1) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isPatikiOffsetStitch(r - midR, c - midC)) set(g, r, c, 0);
    }
  }
  return g;
}

/** Pātiki — diamond centred on the board, repeating out in rings */
function patiki(rows, cols) {
  const g = empty(rows, cols);
  const midR = Math.floor((rows - 1) / 2);
  const midC = Math.floor((cols - 1) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isPatikiStitch(r - midR, c - midC)) set(g, r, c, 0);
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
  patikiOffset,
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
