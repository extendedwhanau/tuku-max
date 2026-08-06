/**
 * Shape drawing — Dot Font kit + niho / triangle systems.
 * rx, ry are half-extents from unitRadius() — this is the real size.
 */

import { S } from "./state.js";

function tipAngle(p, cx, cy) {
  const toCenter = Math.atan2(cy - p.y, cx - p.x);
  const fromCenter = toCenter + Math.PI;
  const gx = p.gx ?? 0;
  const gy = p.gy ?? 0;
  switch (S.direction) {
    case "out":
      return fromCenter;
    case "horizontal-in": {
      const sx = Math.sign(cx - p.x) || 1;
      return sx > 0 ? 0 : Math.PI;
    }
    case "horizontal-out": {
      const sx = Math.sign(p.x - cx) || 1;
      return sx > 0 ? 0 : Math.PI;
    }
    case "alternate":
      return (gx + gy) % 2 === 0 ? toCenter : fromCenter;
    case "row-alt":
      return gy % 2 === 0 ? 0 : Math.PI;
    case "col-alt":
      return gx % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
    case "grid-up":
      return -Math.PI / 2;
    case "grid-down":
      return Math.PI / 2;
    case "in":
    default:
      return toCenter;
  }
}

function fillPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function triPts(x, y, ang, len, base) {
  const tx = Math.cos(ang);
  const ty = Math.sin(ang);
  const bx = -ty;
  const by = tx;
  return [
    { x: x + tx * len, y: y + ty * len },
    { x: x - tx * len * 0.12 + bx * base, y: y - ty * len * 0.12 + by * base },
    { x: x - tx * len * 0.12 - bx * base, y: y - ty * len * 0.12 - by * base },
  ];
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} m metrics from buildMetrics
 * @param {number} time
 */
export function drawUnits(ctx, m, time = 0) {
  const { dots, rx, ry, step } = m;
  if (!dots.length) return;

  // Centroid for niho direction
  let cx = 0,
    cy = 0;
  for (const d of dots) {
    cx += d.x;
    cy += d.y;
  }
  cx /= dots.length;
  cy /= dots.length;

  ctx.fillStyle = S.fg;
  ctx.strokeStyle = S.fg;
  ctx.lineWidth = Math.max(0.5, Math.min(rx, ry) * 0.15);

  const pulse =
    S.motion === "pulse"
      ? 0.85 + 0.15 * Math.sin(time * S.speed * 3)
      : 1;

  for (const d of dots) {
    let prx = rx * pulse;
    let pry = ry * pulse;
    let x = d.x;
    let y = d.y;

    if (S.motion === "wave") {
      y += Math.sin(time * S.speed * 2 + d.gx * 0.4) * (step * 0.15);
    }

    drawOne(ctx, S.shape, x, y, prx, pry, d, cx, cy, time);
  }
}

function drawOne(ctx, shape, x, y, rx, ry, d, cx, cy, time) {
  switch (shape) {
    case "circle":
    case "dot":
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "ring":
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "square": {
      const r = S.round * Math.min(rx, ry);
      roundRectPath(ctx, x - rx, y - ry, rx * 2, ry * 2, r);
      ctx.fill();
      break;
    }
    case "capsule-h":
      roundRectPath(ctx, x - rx * 1.35, y - ry * 0.7, rx * 2.7, ry * 1.4, ry * 0.7);
      ctx.fill();
      break;
    case "capsule-v":
      roundRectPath(ctx, x - rx * 0.7, y - ry * 1.35, rx * 1.4, ry * 2.7, rx * 0.7);
      ctx.fill();
      break;
    case "semicircle": {
      ctx.beginPath();
      const down = S.direction === "grid-down";
      ctx.ellipse(x, y, rx, ry, 0, down ? 0 : Math.PI, down ? Math.PI : 0, false);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "diamond":
      fillPoly(ctx, [
        { x, y: y - ry },
        { x: x + rx, y },
        { x, y: y + ry },
        { x: x - rx, y },
      ]);
      break;
    case "tessellate": {
      const s = Math.min(rx, ry) * 2;
      const flip = ((d.gx ?? 0) + (d.gy ?? 0)) % 4;
      const x0 = x - s / 2;
      const y0 = y - s / 2;
      let pts;
      if (flip === 0) pts = [{ x: x0, y: y0 }, { x: x0 + s, y: y0 }, { x: x0, y: y0 + s }];
      else if (flip === 1) pts = [{ x: x0 + s, y: y0 }, { x: x0 + s, y: y0 + s }, { x: x0, y: y0 }];
      else if (flip === 2) pts = [{ x: x0, y: y0 + s }, { x: x0 + s, y: y0 + s }, { x: x0 + s, y: y0 }];
      else pts = [{ x: x0, y: y0 }, { x: x0 + s, y: y0 + s }, { x: x0, y: y0 + s }];
      fillPoly(ctx, pts);
      break;
    }
    case "saw":
    case "spike":
    case "niho":
    case "triangle": {
      const ang = tipAngle(d, cx, cy);
      const len =
        Math.max(rx, ry) *
        (shape === "spike" ? S.elongation * 1.35 : shape === "niho" ? S.elongation : 1.1);
      const base = Math.min(rx, ry) * (shape === "niho" ? 0.85 : 1);
      const breathe =
        shape === "spike" && S.motion === "pulse"
          ? 0.9 + 0.1 * Math.sin(time * 2 + (d.id || 0))
          : 1;
      fillPoly(ctx, triPts(x, y, ang, len * breathe, base));
      break;
    }
    default:
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
  }
}

export function unitsToSVG(m) {
  const { dots, rx, ry } = m;
  if (!dots.length) return "";

  let cx = 0,
    cy = 0;
  for (const d of dots) {
    cx += d.x;
    cy += d.y;
  }
  cx /= dots.length;
  cy /= dots.length;

  const parts = [];
  const n = (v) => Number(v.toFixed(3));
  const poly = (pts) => {
    const d = pts.map((p, i) => `${i ? "L" : "M"}${n(p.x)},${n(p.y)}`).join(" ") + "Z";
    parts.push(`<path d="${d}" fill="${S.fg}"/>`);
  };

  for (const d of dots) {
    const x = d.x;
    const y = d.y;
    const shape = S.shape;

    if (shape === "circle" || shape === "dot") {
      parts.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${S.fg}"/>`);
    } else if (shape === "ring") {
      parts.push(
        `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="none" stroke="${S.fg}" stroke-width="${n(Math.max(0.5, Math.min(rx, ry) * 0.15))}"/>`
      );
    } else if (shape === "square") {
      parts.push(
        `<rect x="${n(x - rx)}" y="${n(y - ry)}" width="${n(rx * 2)}" height="${n(ry * 2)}" fill="${S.fg}"/>`
      );
    } else if (shape === "diamond") {
      poly([
        { x, y: y - ry },
        { x: x + rx, y },
        { x, y: y + ry },
        { x: x - rx, y },
      ]);
    } else if (shape === "tessellate") {
      const s = Math.min(rx, ry) * 2;
      const flip = ((d.gx ?? 0) + (d.gy ?? 0)) % 4;
      const x0 = x - s / 2;
      const y0 = y - s / 2;
      if (flip === 0) poly([{ x: x0, y: y0 }, { x: x0 + s, y: y0 }, { x: x0, y: y0 + s }]);
      else if (flip === 1) poly([{ x: x0 + s, y: y0 }, { x: x0 + s, y: y0 + s }, { x: x0, y: y0 }]);
      else if (flip === 2) poly([{ x: x0, y: y0 + s }, { x: x0 + s, y: y0 + s }, { x: x0 + s, y: y0 }]);
      else poly([{ x: x0, y: y0 }, { x: x0 + s, y: y0 + s }, { x: x0, y: y0 + s }]);
    } else {
      const ang = tipAngle(d, cx, cy);
      const len =
        Math.max(rx, ry) *
        (shape === "spike" ? S.elongation * 1.35 : shape === "niho" ? S.elongation : 1.1);
      const base = Math.min(rx, ry) * (shape === "niho" ? 0.85 : 1);
      poly(triPts(x, y, ang, len, base));
    }
  }
  return parts.join("\n");
}
