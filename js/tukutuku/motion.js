/**
 * Motion layers — pattern stays on screen; colour layer can drift separately.
 * Contemporary: breath, shimmer, flow — no fade-to-empty.
 */

import { S } from "./state.js";
import { colourAt } from "./colour.js";
import { colourStitchMark } from "./symbol.js";

let raf = 0;
let start = 0;
/** @type {SVGSVGElement | null} */
let svgRef = null;

/** @type {{ row: number, col: number } | null} */
let pointer = null;
let hover = 0;

/** @type {{ row: number, col: number, t0: number } | null} */
let clickRipple = null;

const HOVER_RADIUS = 7;
const CLICK_DURATION = 900;

/** Structure motion — gentle, always readable. */
function structureMotion(r, c, t, mode, speed) {
  const out = { strokeScale: 1 };
  // Slower angular rates for smoother feel
  const sp = speed * 0.65;

  if (mode === "pulse") {
    const phase = Math.sin(t * 0.0016 * sp + (r + c) * 0.08);
    out.strokeScale = 0.82 + 0.28 * (0.5 + 0.5 * phase);
  } else if (mode === "shimmer") {
    const seed = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
    const n = seed - Math.floor(seed);
    const phase = Math.sin(t * 0.0022 * sp + n * 14);
    out.strokeScale = 0.85 + 0.24 * (0.5 + 0.5 * phase);
  } else if (mode === "wave") {
    const phase = Math.sin(t * 0.0014 * sp + c * 0.18 + r * 0.04);
    out.strokeScale = 0.84 + 0.26 * (0.5 + 0.5 * phase);
  } else if (mode === "ripple") {
    const midR = S.rows / 2;
    const midC = S.cols / 2;
    const d = Math.hypot(r - midR, c - midC);
    const phase = Math.sin(t * 0.0018 * sp - d * 0.22);
    out.strokeScale = 0.86 + 0.22 * (0.5 + 0.5 * phase);
  }

  return out;
}

/** Continuous colour-layer phase — no floor snaps. */
function colourPhase(t, mode, speed) {
  const phase = { dr: 0, dc: 0, t: 0, smooth: true };
  if (mode === "none") {
    phase.smooth = false;
    return phase;
  }

  const tick = t * 0.00055 * speed;

  if (mode === "scroll") {
    phase.dc = tick * 2.2;
  } else if (mode === "scroll-v") {
    phase.dr = tick * 2.2;
  } else if (mode === "drift") {
    phase.dc = tick * 1.6;
    phase.dr = tick * 0.85;
  } else if (mode === "sweep") {
    phase.dc = tick * 2.8;
    phase.dr = tick * 1.4;
  } else if (mode === "breathe") {
    phase.t = tick * 1.1;
  } else if (mode === "flicker") {
    phase.t = tick * 2.4;
  } else if (mode === "tide") {
    phase.dc = Math.sin(tick * 0.9) * 2.2;
    phase.dr = Math.cos(tick * 0.7) * 1.6;
  }

  return phase;
}

function influenceAt(r, c, now) {
  let infl = 0;

  if (pointer && hover > 0.01) {
    const d = Math.hypot(r - pointer.row, c - pointer.col);
    const local = Math.max(0, 1 - d / HOVER_RADIUS);
    infl = Math.max(infl, local * local * hover);
  }

  if (clickRipple) {
    const elapsed = now - clickRipple.t0;
    const life = elapsed / CLICK_DURATION;
    if (life >= 1) {
      clickRipple = null;
    } else {
      const d = Math.hypot(r - clickRipple.row, c - clickRipple.col);
      const ring = life * (HOVER_RADIUS * 2.8);
      const band = Math.max(0, 1 - Math.abs(d - ring) / 2.4);
      const fade = 1 - life;
      infl = Math.max(infl, band * fade);
    }
  }

  return infl;
}

function applyFrame(t, now) {
  if (!svgRef) return;
  const stitches = svgRef.querySelectorAll(".stitch");
  const speed = S.speed;
  const { cell, gap, stroke, colourA, colourB, colourMode, rows, cols } = S;
  const geo = { kind: S.geoKind, seed: S.geoSeed };

  const target = pointer ? 1 : 0;
  hover += (target - hover) * 0.1;

  const colourLive =
    S.colourMotion !== "none" &&
    (colourMode === "mumu" ||
      colourMode === "purapura" ||
      colourMode === "geo" ||
      colourMode === "solid");

  // Shared continuous phase (not per-cell floor snaps)
  const sharedPhase = colourPhase(t, S.colourMotion, speed);

  stitches.forEach((g) => {
    const r = Number(g.getAttribute("data-row"));
    const c = Number(g.getAttribute("data-col"));
    const mark = g.querySelector(".stitch-mark");
    if (!mark) return;

    const infl = influenceAt(r, c, now);
    const struct = structureMotion(r, c, t, S.motion, speed);

    let hex = g.getAttribute("data-colour") || colourA;
    if (colourLive) {
      hex = colourAt(r, c, rows, cols, colourMode, colourA, colourB, geo, sharedPhase);
    }

    if (infl > 0.25) {
      const other = hex.toLowerCase() === colourA.toLowerCase() ? colourB : colourA;
      hex = other;
    }

    const rippleStroke = 1 + infl * 0.35;
    colourStitchMark(mark, hex, stroke * struct.strokeScale * rippleStroke);

    const x = c * cell;
    const y = r * (cell + gap);
    const cx = cell / 2;
    const cy = cell / 2;
    const s = 1 + infl * 0.16;
    g.setAttribute(
      "transform",
      `translate(${x} ${y}) translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`
    );
  });
}

function loop(now) {
  if (!start) start = now;
  applyFrame(now - start, now);

  const needsLoop =
    S.motion !== "none" ||
    S.colourMotion !== "none" ||
    pointer != null ||
    hover > 0.02 ||
    clickRipple != null;

  if (needsLoop) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = 0;
    applyFrame(0, now);
  }
}

function ensureLoop() {
  if (!raf) {
    start = 0;
    raf = requestAnimationFrame(loop);
  }
}

export function setMotionTarget(svg) {
  svgRef = svg;
}

export function setPointer(cell) {
  pointer = cell;
  ensureLoop();
}

export function clearPointer() {
  pointer = null;
  ensureLoop();
}

export function triggerPulse(cell) {
  clickRipple = { row: cell.row, col: cell.col, t0: performance.now() };
  ensureLoop();
}

export function startMotion() {
  stopMotion();
  ensureLoop();
}

export function stopMotion() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

export function refreshMotion() {
  startMotion();
}
