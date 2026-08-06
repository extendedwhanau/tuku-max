/**
 * Tukutuku X Grid — controls, pointer ripple, motion, export.
 * Board always fills the stage; cell size drives density.
 */

import { S, boardWidth, boardHeight, fitGridToSize } from "./state.js";
import { generatePattern } from "./patterns.js";
import { randomisePattern } from "./patternRandom.js";
import { colourize, randomiseGeo, geoLabel } from "./colour.js";
import { renderBoard, cellFromPoint } from "./board.js";
import {
  setMotionTarget,
  refreshMotion,
  setPointer,
  clearPointer,
  triggerPulse,
} from "./motion.js";
import { downloadSVG, downloadPNG } from "./export.js";
import { parseCustomSvg } from "./symbol.js";
import {
  loadTypefaceFile,
  resetTypeface,
  prefetchDefaultTypeface,
  DEFAULT_TYPEFACE_NAME,
} from "./typeface.js";

const svg = document.getElementById("board");
const frame = document.getElementById("frame");
const stage = document.querySelector(".stage--tukutuku");
const meta = document.getElementById("meta");
const colourHint = document.getElementById("colourHint");
const gridHint = document.getElementById("gridHint");

const COLOUR_HINTS = {
  solid: "One colour across the pattern.",
  mumu: "Checkerboard of A and B on the stitches.",
  purapura: "Starfield — A is the night, B is the stars.",
  geo: "Geometric colour overlay — hit Randomise for a new one.",
};

function $(id) {
  return document.getElementById(id);
}

function on(id, event, handler) {
  const el = $(id);
  if (!el) return;
  el.addEventListener(event, handler);
}

function applyPattern() {
  if (S.preset === "random") {
    const next = randomisePattern(S.rows, S.cols);
    S.patternLabel = next.label;
    S.mask = next.mask;
    const opt = document.querySelector('#preset option[value="random"]');
    if (opt) opt.textContent = "Random · " + next.label;
    applyColour();
    return;
  }
  S.mask = generatePattern(S.preset, S.rows, S.cols);
  applyColour();
}

function applyColour() {
  if (!S.mask) S.mask = generatePattern(S.preset, S.rows, S.cols);
  S.cells = colourize(S.mask, S.colourMode, S.colourA, S.colourB, {
    kind: S.geoKind,
    seed: S.geoSeed,
  });
}

/**
 * Measure the stage, size the frame, derive cols/rows from cell size.
 * Frame always fills the Width×Height slice of the stage; cell size
 * sets how many stitches pack into that area.
 * @param {{ regenerate?: boolean }} [opts]
 */
function fitAndRebuild(opts = {}) {
  const regenerate = opts.regenerate !== false;

  const stageBox = stage?.getBoundingClientRect();
  const maxW = Math.max(40, (stageBox?.width ?? 800) * (S.boardW / 100));
  const maxH = Math.max(40, (stageBox?.height ?? 600) * (S.boardH / 100));

  if (frame) {
    frame.style.width = `${maxW}px`;
    frame.style.height = `${maxH}px`;
  }

  const gridChanged = fitGridToSize(maxW, maxH);
  if (gridChanged && regenerate) applyPattern();
  else if (!S.mask) applyPattern();

  rebuild();
  syncGridHint();
}

function rebuild() {
  if (!svg) return;
  renderBoard(svg);
  setMotionTarget(svg);
  refreshMotion();
  updateMeta();
}

function syncGridHint() {
  if (!gridHint) return;
  gridHint.textContent = `${S.cols} × ${S.rows}`;
}

function updateMeta() {
  if (!meta) return;
  const w = boardWidth();
  const h = boardHeight();
  const colourLabel =
    S.colourMode === "geo" ? geoLabel(S.geoKind) : S.colourMode;
  const patternLabel = S.patternLabel || S.preset;
  const motionLabel =
    S.colourMotion !== "none"
      ? `${S.motion}+${S.colourMotion}`
      : S.motion;
  meta.textContent = `${S.cols} × ${S.rows} · cell ${S.cell}px · ${Math.round(w)}×${Math.round(h)} · ${patternLabel} · ${S.symbol} · ${colourLabel} · ${motionLabel}`;
}

function colourSelectValue() {
  return S.colourMode === "geo" ? `geo:${S.geoKind}` : S.colourMode;
}

function applyColourSelect(value) {
  if (String(value).startsWith("geo:")) {
    S.colourMode = "geo";
    S.geoKind = value.slice(4);
    return;
  }
  S.colourMode = value;
}

function syncColourUI() {
  const sel = $("colourMode");
  if (sel) sel.value = colourSelectValue();
  if (colourHint) {
    colourHint.textContent =
      S.colourMode === "geo"
        ? geoLabel(S.geoKind)
        : COLOUR_HINTS[S.colourMode] || COLOUR_HINTS.solid;
  }
}

function syncSymbolUI() {
  const sel = $("symbol");
  if (sel) sel.value = S.symbol;
  const word = $("symbolWord");
  if (word) word.value = S.symbolWord;
  const name = $("symbolFileName");
  if (name) {
    name.textContent = S.customSvg?.name || "No file yet";
  }
  const typefaceName = $("typefaceName");
  if (typefaceName) {
    typefaceName.textContent = S.typefaceName || DEFAULT_TYPEFACE_NAME;
  }
  const typefaceReset = $("typefaceReset");
  if (typefaceReset) {
    typefaceReset.hidden = S.typefaceName === DEFAULT_TYPEFACE_NAME;
  }
  const rot = $("symbolRotation");
  const rotN = $("symbolRotationN");
  if (rot) rot.value = String(S.symbolRotation);
  if (rotN) rotN.value = String(S.symbolRotation);
  const wordField = $("symbolWordField");
  if (wordField) {
    wordField.hidden = S.symbol !== "text";
  }
  const typefaceField = $("typefaceField");
  if (typefaceField) {
    typefaceField.hidden = S.symbol !== "text";
  }
  const uploadField = $("symbolUploadField");
  if (uploadField) {
    uploadField.hidden = S.symbol !== "custom";
  }
}

function bindDual(id, key, parse = Number, onChange) {
  const range = $(id);
  const num = $(id + "N");
  if (!range || !num) return;
  const sync = (v) => {
    S[key] = parse(v);
    range.value = String(S[key]);
    num.value = String(S[key]);
    onChange?.(key);
  };
  range.addEventListener("input", () => sync(range.value));
  num.addEventListener("change", () => sync(num.value));
}

function onGridParamChange(key) {
  if (key === "cell" || key === "gap" || key === "boardW" || key === "boardH") {
    fitAndRebuild({ regenerate: true });
    return;
  }
  // stroke only — redraw marks, same grid
  rebuild();
}

if (svg) {
  svg.addEventListener("pointermove", (e) => {
    const cell = cellFromPoint(svg, e.clientX, e.clientY);
    if (cell) setPointer(cell);
    else clearPointer();
  });

  svg.addEventListener("pointerleave", () => {
    clearPointer();
  });

  svg.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const cell = cellFromPoint(svg, e.clientX, e.clientY);
    if (cell) triggerPulse(cell);
  });
}

bindDual("boardW", "boardW", (v) => Math.round(Number(v)), onGridParamChange);
bindDual("boardH", "boardH", (v) => Math.round(Number(v)), onGridParamChange);
bindDual("cell", "cell", (v) => Math.min(38, Math.max(7, Math.round(Number(v)))), onGridParamChange);
bindDual("gap", "gap", Number, onGridParamChange);
bindDual("stroke", "stroke", Number, onGridParamChange);
bindDual("speed", "speed", Number);
bindDual("symbolRotation", "symbolRotation", (v) => {
  let n = Math.round(Number(v));
  if (!Number.isFinite(n)) n = 0;
  n = ((n % 360) + 360) % 360;
  return n;
}, () => rebuild());

on("preset", "change", (e) => {
  S.preset = e.target.value;
  S.patternLabel = e.target.selectedOptions[0]?.textContent || S.preset;
  applyPattern();
  rebuild();
});

on("symbol", "change", (e) => {
  S.symbol = e.target.value;
  syncSymbolUI();
  rebuild();
});

on("symbolWord", "input", (e) => {
  S.symbolWord = e.target.value || "RONGO";
  if (S.symbol !== "text") {
    S.symbol = "text";
    syncSymbolUI();
  }
  rebuild();
});

on("symbolFile", "change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = parseCustomSvg(text, file.name);
    if (!parsed) {
      if ($("symbolFileName")) $("symbolFileName").textContent = "Could not read SVG";
      return;
    }
    S.customSvg = parsed;
    S.symbol = "custom";
    syncSymbolUI();
    rebuild();
  } catch {
    if ($("symbolFileName")) $("symbolFileName").textContent = "Could not read SVG";
  }
});

on("typefaceFile", "change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await loadTypefaceFile(file);
    if (S.symbol !== "text") S.symbol = "text";
    syncSymbolUI();
    rebuild();
  } catch {
    if ($("typefaceName")) $("typefaceName").textContent = "Could not load font";
  }
});

on("typefaceReset", "click", () => {
  resetTypeface();
  const input = $("typefaceFile");
  if (input) input.value = "";
  syncSymbolUI();
  rebuild();
});

on("randomisePattern", "click", () => {
  const next = randomisePattern(S.rows, S.cols);
  S.preset = "random";
  S.patternLabel = next.label;
  S.mask = next.mask;
  applyColour();
  const sel = $("preset");
  if (sel) {
    if (![...sel.options].some((o) => o.value === "random")) {
      const opt = document.createElement("option");
      opt.value = "random";
      opt.textContent = "Random · " + next.label;
      sel.appendChild(opt);
    } else {
      sel.querySelector('option[value="random"]').textContent =
        "Random · " + next.label;
    }
    sel.value = "random";
  }
  rebuild();
});

on("colourMode", "change", (e) => {
  applyColourSelect(e.target.value);
  syncColourUI();
  applyColour();
  rebuild();
});

on("colourA", "input", (e) => {
  S.colourA = e.target.value;
  applyColour();
  rebuild();
});

on("colourB", "input", (e) => {
  S.colourB = e.target.value;
  applyColour();
  rebuild();
});

on("randomiseColour", "click", () => {
  const next = randomiseGeo(true);
  S.colourMode = next.colourMode;
  S.geoKind = next.kind;
  S.geoSeed = next.seed;
  S.colourA = next.colourA;
  S.colourB = next.colourB;
  if ($("colourA")) $("colourA").value = S.colourA;
  if ($("colourB")) $("colourB").value = S.colourB;
  syncColourUI();
  applyColour();
  rebuild();
});

on("motion", "change", (e) => {
  S.motion = e.target.value;
  refreshMotion();
  updateMeta();
});

on("colourMotion", "change", (e) => {
  S.colourMotion = e.target.value;
  refreshMotion();
  updateMeta();
});

on("exportSvg", "click", downloadSVG);
on("exportPng", "click", downloadPNG);

if ($("colourA")) $("colourA").value = S.colourA;
if ($("colourB")) $("colourB").value = S.colourB;
if ($("colourMode")) $("colourMode").value = colourSelectValue();
if ($("boardW")) $("boardW").value = String(S.boardW);
if ($("boardWN")) $("boardWN").value = String(S.boardW);
if ($("boardH")) $("boardH").value = String(S.boardH);
if ($("boardHN")) $("boardHN").value = String(S.boardH);
if ($("cell")) $("cell").value = String(S.cell);
if ($("cellN")) $("cellN").value = String(S.cell);
syncColourUI();
syncSymbolUI();
prefetchDefaultTypeface();

// Fit after layout, then watch for resize
requestAnimationFrame(() => {
  fitAndRebuild({ regenerate: true });
});

if (stage && typeof ResizeObserver !== "undefined") {
  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fitAndRebuild({ regenerate: true }), 60);
  });
  ro.observe(stage);
}
