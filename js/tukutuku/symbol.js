/**
 * Stitch symbol geometry — X, circle, triangle, square, text, or custom SVG.
 */

import { typefaceCssStack } from "./typeface.js";

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

function padFor(size) {
  return Math.max(1.2, size * 0.18);
}

function xPath(size, pad) {
  const a = pad;
  const b = size - pad;
  return `M${a} ${a} L${b} ${b} M${b} ${a} L${a} ${b}`;
}

function trianglePoints(size, pad) {
  const mid = size / 2;
  return `${mid},${pad} ${size - pad},${size - pad} ${pad},${size - pad}`;
}

/**
 * Parse uploaded SVG text into reusable custom mark data.
 * @returns {{ markup: string, viewBox: { x: number, y: number, w: number, h: number }, name: string } | null}
 */
export function parseCustomSvg(text, name = "custom.svg") {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return null;

  let x = 0;
  let y = 0;
  let w = 100;
  let h = 100;
  const vb = root.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      [x, y, w, h] = parts;
    }
  } else {
    const rw = parseFloat(root.getAttribute("width") || "");
    const rh = parseFloat(root.getAttribute("height") || "");
    if (Number.isFinite(rw) && Number.isFinite(rh) && rw > 0 && rh > 0) {
      w = rw;
      h = rh;
    }
  }
  if (!(w > 0 && h > 0)) return null;

  return {
    markup: root.innerHTML,
    viewBox: { x, y, w, h },
    name,
  };
}

function tintCustomTree(node, hex) {
  if (node.nodeType !== 1) return;
  const tag = node.tagName.toLowerCase();
  if (tag !== "g" && tag !== "svg" && tag !== "defs" && tag !== "clippath" && tag !== "mask") {
    const fill = node.getAttribute("fill");
    const stroke = node.getAttribute("stroke");
    if (!fill || (fill !== "none" && fill !== "transparent")) {
      node.setAttribute("fill", hex);
    }
    if (stroke && stroke !== "none" && stroke !== "transparent") {
      node.setAttribute("stroke", hex);
    } else if (!stroke && (!fill || fill === "none")) {
      node.setAttribute("stroke", hex);
      if (!node.getAttribute("fill")) node.setAttribute("fill", "none");
    }
  }
  for (const child of [...node.children]) tintCustomTree(child, hex);
}

/**
 * Letter for text mode — word tiles across the full grid (row-major).
 */
export function letterAt(row, col, cols, word) {
  const raw = String(word || "").replace(/\s+/g, "");
  if (!raw.length) return "·";
  const i = (row * cols + col) % raw.length;
  return raw[i];
}

/**
 * Append a stitch mark into a cell group (live board).
 * @param {SVGGElement} parent
 * @param {{ size: number, stroke: number, hex: string, symbol: string, rotation: number, custom: object|null, letter?: string }} opts
 */
export function appendStitchSymbol(parent, opts) {
  const {
    size,
    stroke,
    hex,
    symbol,
    rotation = 0,
    custom = null,
    letter = null,
  } = opts;
  const pad = padFor(size);
  const cx = size / 2;
  const cy = size / 2;
  const wrap = el("g", {
    class: "stitch-mark",
    transform: `translate(${cx} ${cy}) rotate(${rotation}) translate(${-cx} ${-cy})`,
  });

  const kind =
    symbol === "text"
      ? "text"
      : symbol === "custom" && custom
        ? "custom"
        : symbol;

  if (kind === "text") {
    const ch = letter || "·";
    const fontSize = Math.max(4, size * 0.72);
    const text = el("text", {
      class: "stitch-fill stitch-text",
      x: cx,
      y: cy,
      fill: hex,
      "font-size": fontSize,
      "font-family": typefaceCssStack(),
      "font-weight": "600",
      "text-anchor": "middle",
      "dominant-baseline": "central",
    });
    text.textContent = ch;
    wrap.appendChild(text);
  } else if (kind === "circle") {
    wrap.appendChild(
      el("circle", {
        class: "stitch-fill",
        cx,
        cy,
        r: size / 2 - pad,
        fill: hex,
      })
    );
  } else if (kind === "square") {
    wrap.appendChild(
      el("rect", {
        class: "stitch-fill",
        x: pad,
        y: pad,
        width: size - pad * 2,
        height: size - pad * 2,
        fill: hex,
      })
    );
  } else if (kind === "triangle") {
    wrap.appendChild(
      el("polygon", {
        class: "stitch-fill",
        points: trianglePoints(size, pad),
        fill: hex,
      })
    );
  } else if (kind === "custom" && custom) {
    const { viewBox: vb, markup } = custom;
    const scale = (size - pad * 2) / Math.max(vb.w, vb.h);
    const drawnW = vb.w * scale;
    const drawnH = vb.h * scale;
    const ox = (size - drawnW) / 2;
    const oy = (size - drawnH) / 2;
    const customG = el("g", {
      class: "stitch-custom",
      transform: `translate(${ox} ${oy}) scale(${scale}) translate(${-vb.x} ${-vb.y})`,
    });
    const tmp = el("g");
    tmp.innerHTML = markup;
    while (tmp.firstChild) {
      const child = tmp.firstChild;
      tintCustomTree(child, hex);
      customG.appendChild(child);
    }
    wrap.appendChild(customG);
  } else {
    wrap.appendChild(
      el("path", {
        class: "stitch-stroke",
        d: xPath(size, pad),
        fill: "none",
        stroke: hex,
        "stroke-width": stroke,
        "stroke-linecap": "round",
      })
    );
  }

  parent.appendChild(wrap);
  return wrap;
}

/**
 * Colour a live stitch mark (motion / ripple).
 */
export function colourStitchMark(mark, hex, strokeWidth) {
  if (!mark) return;
  mark.querySelectorAll(".stitch-stroke").forEach((p) => {
    p.setAttribute("stroke", hex);
    if (strokeWidth != null) p.setAttribute("stroke-width", String(strokeWidth));
  });
  mark.querySelectorAll(".stitch-fill").forEach((p) => {
    p.setAttribute("fill", hex);
  });
  mark.querySelectorAll(".stitch-custom").forEach((g) => {
    tintCustomTree(g, hex);
  });
}

/**
 * SVG markup string for one stitch (export).
 */
export function stitchSymbolSVG(opts) {
  const {
    size,
    stroke,
    hex,
    symbol,
    rotation = 0,
    custom = null,
    letter = null,
  } = opts;
  const pad = padFor(size);
  const cx = size / 2;
  const cy = size / 2;
  const rot = `translate(${cx} ${cy}) rotate(${rotation}) translate(${-cx} ${-cy})`;
  const kind =
    symbol === "text"
      ? "text"
      : symbol === "custom" && custom
        ? "custom"
        : symbol;

  if (kind === "text") {
    const ch = letter || "·";
    const fontSize = Math.max(4, size * 0.72);
    const esc = String(ch)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const fam = typefaceCssStack().replace(/"/g, "'");
    return `<g class="stitch-mark" transform="${rot}"><text x="${cx}" y="${cy}" fill="${hex}" font-size="${fontSize}" font-family="${fam}" font-weight="600" text-anchor="middle" dominant-baseline="central">${esc}</text></g>`;
  }
  if (kind === "circle") {
    const r = size / 2 - pad;
    return `<g class="stitch-mark" transform="${rot}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${hex}"/></g>`;
  }
  if (kind === "square") {
    const s = size - pad * 2;
    return `<g class="stitch-mark" transform="${rot}"><rect x="${pad}" y="${pad}" width="${s}" height="${s}" fill="${hex}"/></g>`;
  }
  if (kind === "triangle") {
    return `<g class="stitch-mark" transform="${rot}"><polygon points="${trianglePoints(size, pad)}" fill="${hex}"/></g>`;
  }
  if (kind === "custom" && custom) {
    const { viewBox: vb, markup } = custom;
    const scale = (size - pad * 2) / Math.max(vb.w, vb.h);
    const drawnW = vb.w * scale;
    const drawnH = vb.h * scale;
    const ox = (size - drawnW) / 2;
    const oy = (size - drawnH) / 2;
    const tinted = markup
      .replace(/\sfill="(?!none|transparent)[^"]*"/gi, ` fill="${hex}"`)
      .replace(/\sstroke="(?!none|transparent)[^"]*"/gi, ` stroke="${hex}"`);
    return `<g class="stitch-mark" transform="${rot}"><g transform="translate(${ox} ${oy}) scale(${scale}) translate(${-vb.x} ${-vb.y})" fill="${hex}" stroke="${hex}">${tinted}</g></g>`;
  }
  return `<g class="stitch-mark" transform="${rot}"><path d="${xPath(size, pad)}" fill="none" stroke="${hex}" stroke-width="${stroke}" stroke-linecap="round"/></g>`;
}
