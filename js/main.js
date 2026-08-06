/**
 * App — render loop, UI binding, canvas presentation.
 */

import { S, fontPx, gridStep } from "./state.js";
import { loadDefaultFont, loadFontFile } from "./fonts.js";
import { buildMetrics, fitTextToCanvas } from "./mask.js";
import { drawUnits } from "./shapes.js";
import { exportSVG } from "./export.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stageFrame = document.getElementById("stageFrame");
const metaInfo = document.getElementById("metaInfo");

let metrics = null;
let dirty = true;
let time = 0;

function markDirty() {
  dirty = true;
}

function rebuild() {
  metrics = buildMetrics();
  dirty = false;
  const step = gridStep();
  const fs = fontPx();
  metaInfo.textContent = metrics
    ? `${S.canvasW}×${S.canvasH} · type ${fs.toFixed(0)}px · shape ${S.shapeSize} · gap ${S.gap} · step ${step} · ${metrics.dots.length} units`
    : "—";
}

/** Present canvas letterboxed inside stage. */
function layoutStage() {
  const stage = canvas.parentElement.parentElement;
  const rect = stage.getBoundingClientRect();
  const pad = 32;
  const availW = Math.max(100, rect.width - pad * 2);
  const availH = Math.max(100, rect.height - pad * 2 - 28);
  const scale = Math.min(availW / S.canvasW, availH / S.canvasH);
  const cssW = Math.floor(S.canvasW * scale);
  const cssH = Math.floor(S.canvasH * scale);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(S.canvasW * dpr);
  canvas.height = Math.floor(S.canvasH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  stageFrame.style.width = `${cssW}px`;
  stageFrame.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  markDirty();
}

function applyRatio(ratio) {
  S.ratio = ratio;
  const lock = (w, h) => {
    S.canvasW = w;
    S.canvasH = h;
    syncPair("canvasW", "canvasWN", w);
    syncPair("canvasH", "canvasHN", h);
  };
  if (ratio === "1:1") lock(1080, 1080);
  else if (ratio === "9:16") lock(1080, 1920);
  else if (ratio === "4:5") lock(1080, 1350);
  else if (ratio === "16:9") lock(1920, 1080);
  else if (ratio === "1080") lock(1080, 1080);
  else if (ratio === "1920") lock(1920, 1080);
  layoutStage();
}

function syncPair(rangeId, numId, value) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numId);
  if (r) r.value = value;
  if (n) n.value = value;
}

function bindDual(rangeId, numId, prop, { float = false, onChange = null } = {}) {
  const range = document.getElementById(rangeId);
  const num = document.getElementById(numId);
  const apply = (v) => {
    const n = float ? parseFloat(v) : parseInt(v, 10);
    if (Number.isNaN(n)) return;
    S[prop] = n;
    range.value = n;
    num.value = n;
    if (onChange) onChange(n);
    markDirty();
  };
  range.addEventListener("input", () => apply(range.value));
  num.addEventListener("change", () => apply(num.value));
  num.addEventListener("keydown", (e) => {
    if (e.key === "Enter") apply(num.value);
  });
}

function draw() {
  if (dirty) rebuild();
  if (!metrics) return;

  const W = S.canvasW;
  const H = S.canvasH;
  const dpr = canvas.width / W;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = S.bg;
  ctx.fillRect(0, 0, W, H);

  const c = metrics.content;
  const ox = (W - c.width) / 2 - c.minX + S.panX;
  const oy = (H - c.height) / 2 - c.minY + S.panY;

  if (S.showGrid && metrics.dots.length) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    const step = metrics.step;
    const x0 = ((ox % step) + step) % step;
    const y0 = ((oy % step) + step) % step;
    ctx.beginPath();
    for (let x = x0; x <= W; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = y0; y <= H; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(ox, oy);
  drawUnits(ctx, metrics, time);
  ctx.restore();

  if (S.showFrame) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.restore();
  }
}

function wire() {
  bindDual("canvasW", "canvasWN", "canvasW", {
    onChange: () => layoutStage(),
  });
  bindDual("canvasH", "canvasHN", "canvasH", {
    onChange: () => layoutStage(),
  });
  bindDual("fontSizePct", "fontSizePctN", "fontSizePct", { float: true });
  bindDual("tracking", "trackingN", "tracking");
  bindDual("lineH", "lineHN", "lineH", { float: true });
  bindDual("fitPadding", "fitPaddingN", "fitPadding");
  bindDual("shapeSize", "shapeSizeN", "shapeSize");
  bindDual("gap", "gapN", "gap");
  bindDual("threshold", "thresholdN", "threshold");
  bindDual("elongation", "elongationN", "elongation", { float: true });
  bindDual("sx", "sxN", "sx", { float: true });
  bindDual("sy", "syN", "sy", { float: true });
  bindDual("speed", "speedN", "speed", { float: true });

  const mapSelect = (id, prop) => {
    const el = document.getElementById(id);
    el.value = S[prop];
    el.addEventListener("change", () => {
      S[prop] = el.value;
      markDirty();
    });
  };
  mapSelect("align", "align");
  mapSelect("pattern", "pattern");
  mapSelect("shape", "shape");
  mapSelect("direction", "direction");
  mapSelect("motion", "motion");

  document.getElementById("textInput").addEventListener("input", (e) => {
    S.text = e.target.value;
    markDirty();
  });

  document.getElementById("showFrame").addEventListener("change", (e) => {
    S.showFrame = e.target.checked;
  });
  document.getElementById("showGrid").addEventListener("change", (e) => {
    S.showGrid = e.target.checked;
  });

  document.getElementById("ratio").addEventListener("change", (e) => {
    applyRatio(e.target.value);
  });

  document.getElementById("fitBtn").addEventListener("click", () => {
    fitTextToCanvas();
    syncPair("fontSizePct", "fontSizePctN", Number(S.fontSizePct.toFixed(2)));
    markDirty();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    if (dirty) rebuild();
    exportSVG(metrics);
  });

  document.getElementById("fontInput").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadFontFile(file);
      document.getElementById("fontName").textContent = S.fontName;
      markDirty();
    } catch (err) {
      console.error(err);
      document.getElementById("fontName").textContent = "Could not load font";
    }
  });

  window.addEventListener("resize", () => layoutStage());
}

async function boot() {
  wire();
  document.getElementById("fontName").textContent = "Loading font…";
  try {
    await loadDefaultFont();
    document.getElementById("fontName").textContent = S.fontName;
  } catch (err) {
    console.error(err);
    document.getElementById("fontName").textContent = "Upload a font to begin";
  }
  layoutStage();

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(64, now - last);
    last = now;
    time += dt * 0.001;
    draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot();
