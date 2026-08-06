/**
 * Live SVG Tukutuku board — stitch symbols on a grid.
 */

import { S, boardWidth, boardHeight } from "./state.js";
import { appendStitchSymbol, letterAt } from "./symbol.js";

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * @param {SVGSVGElement} svg
 */
export function renderBoard(svg) {
  const W = boardWidth();
  const H = boardHeight();
  const {
    cols,
    rows,
    cell,
    gap,
    stroke,
    cells,
    symbol,
    symbolRotation,
    customSvg,
    symbolWord,
  } = S;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.replaceChildren();

  const root = el("g", { class: "board-root" });
  root.appendChild(el("rect", { width: W, height: H, fill: "#0a0a0a" }));

  const stitches = el("g", { class: "stitches" });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hex = cells[r]?.[c];
      if (!hex) continue;
      const x = c * cell;
      const y = r * (cell + gap);
      const g = el("g", {
        class: "stitch",
        transform: `translate(${x} ${y})`,
        "data-row": r,
        "data-col": c,
        "data-colour": hex,
      });
      appendStitchSymbol(g, {
        size: cell,
        stroke,
        hex,
        symbol,
        rotation: symbolRotation,
        custom: customSvg,
        letter: letterAt(r, c, cols, symbolWord),
      });
      stitches.appendChild(g);
    }
  }
  root.appendChild(stitches);
  svg.appendChild(root);
}

export function cellFromPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  const col = Math.floor(local.x / S.cell);
  const row = Math.floor(local.y / (S.cell + S.gap));
  if (row < 0 || col < 0 || row >= S.rows || col >= S.cols) return null;
  return { row, col };
}
