/**
 * Random tukutuku patterns — simple graphic variations of the refined forms.
 * Kaokao, poutama, double, pātiki, large pātiki, niho with clean parameters.
 */

import { generatePattern, isPatikiDiamond } from "./patterns.js";

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function empty(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
}

function set(g, r, c) {
  if (r < 0 || c < 0 || r >= g.length || c >= g[0].length) return;
  g[r][c] = 0;
}

function walkPoutamaStrand(g, rows, cols, r0, c0, t, seg, goRight, goUp) {
  let r = r0;
  let c = c0;
  const dc = goRight ? 1 : -1;
  const dr = goUp ? -1 : 1;
  const steps = Math.ceil((rows + cols) / Math.max(1, seg - t)) + 4;

  for (let n = 0; n < steps; n++) {
    for (let i = 0; i < seg; i++) {
      for (let k = 0; k < t; k++) {
        set(g, r + dr * i, c + (goRight ? k : -k));
      }
    }
    const endR = r + dr * (seg - 1);
    for (let i = 0; i < seg; i++) {
      for (let k = 0; k < t; k++) {
        const rr = goUp ? endR + k : endR - k;
        set(g, rr, c + dc * i);
      }
    }
    r = goUp ? endR + t - 1 : endR - (t - 1);
    c = c + dc * (seg - t);
  }
}

/** Clean parametric kaokao */
function genKaokao(rows, cols, rand) {
  const g = empty(rows, cols);
  const thick = 2 + Math.floor(rand() * 3); // 2–4
  const halfZig = Math.max(thick * 2, Math.round(cols / (4 + Math.floor(rand() * 3))));
  const period = halfZig * 2;
  const pitch = thick * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const phase = ((c % period) + period) % period;
      const tri = phase <= halfZig ? phase : period - phase;
      const dist = ((r - tri) % pitch + pitch) % pitch;
      if (dist < thick) set(g, r, c);
    }
  }
  return g;
}

/** Clean parametric poutama */
function genPoutama(rows, cols, rand) {
  const g = empty(rows, cols);
  const t = 2 + Math.floor(rand() * 3);
  const seg = t * (2 + Math.floor(rand() * 2));
  const pitch = t * 2;
  const goRight = rand() > 0.3;
  const n = Math.ceil((rows + cols) / pitch) + 2;
  for (let k = -n; k <= n; k++) {
    const r0 = rows - 1 + k * pitch;
    const c0 = goRight ? k * pitch : cols - 1 - k * pitch;
    walkPoutamaStrand(g, rows, cols, r0, c0, t, seg, goRight, true);
  }
  return g;
}

/** Clean double poutama */
function genDouble(rows, cols, rand) {
  const g = empty(rows, cols);
  const mid = Math.floor((cols - 1) / 2);
  const halfW = Math.max(mid + 1, cols - mid);
  const t = 2 + Math.floor(rand() * 2);
  const seg = t * (2 + Math.floor(rand() * 2));
  const pitch = t * 2;
  const n = Math.ceil((rows + halfW) / pitch) + 2;
  const arm = empty(rows, halfW + seg);
  for (let k = -n; k <= n; k++) {
    walkPoutamaStrand(arm, rows, halfW + seg, rows - 1 + k * pitch, k * pitch, t, seg, true, true);
  }
  const flip = rand() > 0.5;
  for (let r = 0; r < rows; r++) {
    const srcR = flip ? rows - 1 - r : r;
    for (let x = 0; x < halfW; x++) {
      if (arm[srcR]?.[halfW - 1 - x] == null) continue;
      set(g, r, mid + x);
      set(g, r, mid - x);
    }
  }
  return g;
}

/** Small repeating pātiki with centre triangles */
function genPatiki(rows, cols, rand) {
  const g = empty(rows, cols);
  const size = 9 + Math.floor(rand() * 3);
  const period = size * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pr = ((r % period) - size + period) % period - size;
      const pc = ((c % period) - size + period) % period - size;
      if (isPatikiDiamond(pr, pc, size)) set(g, r, c);
    }
  }
  return g;
}

/** Large concentric pātiki — empty centre, 1-on / 2-off diamond rings */
function genLargePatiki(rows, cols, rand) {
  const g = empty(rows, cols);
  const midR = Math.floor((rows - 1) / 2);
  const midC = Math.floor((cols - 1) / 2);
  // Prefer readable rings; rarely denser
  const step = rand() < 0.2 ? 4 : 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const d = Math.abs(r - midR) + Math.abs(c - midC);
      if (d > 0 && d % step === 1) set(g, r, c);
    }
  }
  return g;
}

/** Clean niho — sharp cut triangles with gutters */
function genNiho(rows, cols, rand) {
  const g = empty(rows, cols);
  const nTeeth = 3 + Math.floor(rand() * 4);
  const toothW = Math.max(4, Math.floor(cols / nTeeth));
  const toothH = Math.max(4, Math.round(toothW * (0.7 + rand() * 0.35)));
  const pitch = toothH + 1;
  const gutter = 1;

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
          if (c < baseC || c >= baseC + innerW || c < 0 || c >= cols) continue;
          set(g, r, c);
        }
      }
    }
  }
  return g;
}

const FORMS = [
  { id: "kaokao", label: "Kaokao", fn: genKaokao },
  { id: "poutama", label: "Poutama", fn: genPoutama },
  { id: "doublePoutama", label: "Double Poutama", fn: genDouble },
  { id: "patiki", label: "Pātiki", fn: genPatiki },
  { id: "largePatiki", label: "Large Pātiki", fn: genLargePatiki },
  { id: "niho", label: "Niho Taniwha", fn: genNiho },
];

/**
 * @returns {{ id: string, label: string, seed: number, mask: (number|null)[][] }}
 */
export function randomisePattern(rows, cols, seed = Math.floor(Math.random() * 1e9)) {
  const rand = rng(seed);
  const form = pick(rand, FORMS);

  // Mostly parametric variation; sometimes the exact refined preset
  let mask;
  let label = form.label;
  let id = form.id;
  if (rand() < 0.28) {
    mask = generatePattern(form.id, rows, cols);
  } else {
    id = form.id + "-var";
    mask = form.fn(rows, cols, rand);
  }

  mask = mask.map((row) => row.map((v) => (v == null ? null : 0)));

  let on = 0;
  for (const row of mask) for (const v of row) if (v != null) on++;
  if (on < rows * cols * 0.03) {
    return randomisePattern(rows, cols, seed + 17);
  }

  return { id, label, seed, mask };
}
