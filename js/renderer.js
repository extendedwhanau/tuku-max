/**
 * Renderer — Dot Font Tool–style primitives + Māori triangle systems.
 *
 * Units replace sample points. Direction rules drive “in / out” niho logic:
 * tips face the glyph centre (in), away (out), or alternate by grid.
 */

/**
 * Shape size is independent of type size.
 * shapeSize 0–1 = how much of the pixel cell the unit fills.
 */
function unitSize(p, shapeSize, spacing) {
  const cell = spacing || 12;
  const fill = Math.max(0.05, Math.min(1.2, shapeSize ?? 0.7));
  return Math.max(0.5, (cell * 0.5) * fill * (p.scale ?? 1));
}

function fillPoly(ctx, pts) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function tri(cx, cy, tipAngle, length, base) {
  const tx = Math.cos(tipAngle);
  const ty = Math.sin(tipAngle);
  const bx = -ty;
  const by = tx;
  const tip = { x: cx + tx * length, y: cy + ty * length };
  const b0 = { x: cx - tx * length * 0.15 + bx * base, y: cy - ty * length * 0.15 + by * base };
  const b1 = { x: cx - tx * length * 0.15 - bx * base, y: cy - ty * length * 0.15 - by * base };
  return [tip, b0, b1];
}

function rightTri(x, y, s, flip) {
  // Axis-aligned right triangle tessera
  if (flip === 0) return [{ x, y }, { x: x + s, y }, { x, y: y + s }];
  if (flip === 1) return [{ x: x + s, y }, { x: x + s, y: y + s }, { x, y }];
  if (flip === 2) return [{ x, y: y + s }, { x: x + s, y: y + s }, { x: x + s, y }];
  return [{ x, y }, { x: x + s, y: y + s }, { x, y: y + s }];
}

/** Tip angle for in/out systems. */
function tipAngle(p, direction, cx, cy) {
  const toCenter = Math.atan2(cy - p.y, cx - p.x);
  const fromCenter = toCenter + Math.PI;
  const gx = p.gx ?? 0;
  const gy = p.gy ?? 0;

  switch (direction) {
    case "out":
      return fromCenter;
    case "horizontal-in": {
      // Niho along stems: tip points toward vertical centreline
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
    case "tangent":
      return (p.angle ?? 0) + Math.PI / 2;
    case "grid-up":
      return -Math.PI / 2;
    case "grid-down":
      return Math.PI / 2;
    case "in":
    default:
      return toCenter;
  }
}

export class Renderer {
  draw(ctx, points, opts) {
    const {
      mode = "dot",
      shapeSize = 0.7,
      strokeWeight = 1,
      spacing = 12,
      time = 0,
      color = "#ffffff",
      direction = "in",
      cx = 0,
      cy = 0,
      elongation = 1.6,
    } = opts;

    // Back-compat if callers still pass elementScale
    const size = opts.elementScale != null ? opts.elementScale : shapeSize;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWeight;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.globalAlpha = 1;

    switch (mode) {
      case "capsule-h":
        this._capsules(ctx, points, size, spacing, true);
        break;
      case "capsule-v":
        this._capsules(ctx, points, size, spacing, false);
        break;
      case "semicircle":
        this._semicircles(ctx, points, size, spacing, direction);
        break;
      case "triangle":
        this._triangles(ctx, points, size, spacing, direction, cx, cy, elongation * 0.85);
        break;
      case "niho":
        this._niho(ctx, points, size, spacing, direction, cx, cy, elongation);
        break;
      case "saw":
        this._saw(ctx, points, size, spacing, direction, cx, cy);
        break;
      case "tessellate":
        this._tessellate(ctx, points, size, spacing);
        break;
      case "spike":
        this._spike(ctx, points, size, spacing, direction, cx, cy, elongation, time);
        break;
      case "ring":
        this._rings(ctx, points, size, spacing, strokeWeight);
        break;
      case "square":
        this._squares(ctx, points, size, spacing);
        break;
      default:
        this._dots(ctx, points, size, spacing);
    }

    ctx.restore();
  }

  toSVG(points, opts) {
    const {
      mode = "dot",
      shapeSize = 0.7,
      strokeWeight = 1,
      spacing = 12,
      color = "#111111",
      direction = "in",
      cx = 0,
      cy = 0,
      elongation = 1.6,
    } = opts;

    const size = opts.elementScale != null ? opts.elementScale : shapeSize;
    const parts = [];
    const poly = (pts) => {
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ") + " Z";
      parts.push(`<path d="${d}" fill="${color}"/>`);
    };

    for (const p of points) {
      const s = unitSize(p, size, spacing);
      const ang = tipAngle(p, direction, cx, cy);

      if (mode === "dot" || mode === "ring") {
        if (mode === "ring") {
          parts.push(
            `<circle cx="${p.x}" cy="${p.y}" r="${s}" fill="none" stroke="${color}" stroke-width="${strokeWeight}"/>`
          );
        } else {
          parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${s}" fill="${color}"/>`);
        }
      } else if (mode === "square") {
        parts.push(
          `<rect x="${p.x - s}" y="${p.y - s}" width="${s * 2}" height="${s * 2}" fill="${color}"/>`
        );
      } else if (mode === "capsule-h" || mode === "capsule-v") {
        const horiz = mode === "capsule-h";
        const w = horiz ? s * 2.2 : s * 0.95;
        const h = horiz ? s * 0.95 : s * 2.2;
        const r = Math.min(w, h) / 2;
        parts.push(
          `<rect x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${color}"/>`
        );
      } else if (mode === "semicircle") {
        const r = s * 1.15;
        const up = direction === "grid-down" ? 1 : -1;
        parts.push(
          `<path d="M${p.x - r},${p.y} A${r},${r} 0 0 ${up > 0 ? 0 : 1} ${p.x + r},${p.y} Z" fill="${color}"/>`
        );
      } else if (mode === "tessellate") {
        const cell = spacing * Math.min(1, size);
        const flip = ((p.gx ?? 0) + (p.gy ?? 0)) % 4;
        poly(rightTri(p.x - cell / 2, p.y - cell / 2, cell, flip));
      } else if (mode === "saw") {
        const len = s * 1.5;
        const base = s * 0.85;
        const horizontal = direction === "col-alt" || direction === "grid-up" || direction === "grid-down";
        const a = horizontal
          ? (p.gy ?? 0) % 2 === 0
            ? -Math.PI / 2
            : Math.PI / 2
          : tipAngle(p, "horizontal-in", cx, cy);
        poly(tri(p.x, p.y, a, len, base));
      } else {
        const len = s * (mode === "spike" ? elongation * 1.35 : elongation);
        const base = s * (mode === "niho" ? 0.55 : 0.7);
        poly(tri(p.x, p.y, ang, len, base));
      }
    }

    return parts.join("\n");
  }

  _dots(ctx, points, elementScale, spacing) {
    ctx.beginPath();
    for (const p of points) {
      const r = unitSize(p, elementScale, spacing);
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  _rings(ctx, points, elementScale, spacing, strokeWeight) {
    ctx.lineWidth = strokeWeight;
    for (const p of points) {
      const r = unitSize(p, elementScale, spacing);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _squares(ctx, points, elementScale, spacing) {
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    }
  }

  _capsules(ctx, points, elementScale, spacing, horiz) {
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      const w = horiz ? s * 2.2 : s * 0.95;
      const h = horiz ? s * 0.95 : s * 2.2;
      const r = Math.min(w, h) / 2;
      const x = p.x - w / 2;
      const y = p.y - h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    }
  }

  _semicircles(ctx, points, elementScale, spacing, direction) {
    const down = direction === "grid-down";
    for (const p of points) {
      const r = unitSize(p, elementScale, spacing) * 1.15;
      ctx.beginPath();
      if (down) ctx.arc(p.x, p.y, r, 0, Math.PI, false);
      else ctx.arc(p.x, p.y, r, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
    }
  }

  _triangles(ctx, points, elementScale, spacing, direction, cx, cy, elongation) {
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      const ang = tipAngle(p, direction, cx, cy);
      fillPoly(ctx, tri(p.x, p.y, ang, s * elongation, s * 0.7));
    }
  }

  /** Niho — dragon-tooth spikes; default horizontal-in (toward centreline). */
  _niho(ctx, points, elementScale, spacing, direction, cx, cy, elongation) {
    const dir = direction === "in" ? "horizontal-in" : direction === "out" ? "horizontal-out" : direction;
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      const ang = tipAngle(p, dir, cx, cy);
      fillPoly(ctx, tri(p.x, p.y, ang, s * elongation * 1.25, s * 0.5));
    }
  }

  /** Saw — stacked serrations along columns / rows. */
  _saw(ctx, points, elementScale, spacing, direction, cx, cy) {
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      let ang;
      if (direction === "col-alt" || direction === "grid-up" || direction === "grid-down") {
        ang = (p.gy ?? 0) % 2 === 0 ? -Math.PI / 2 : Math.PI / 2;
      } else if (direction === "row-alt") {
        ang = (p.gx ?? 0) % 2 === 0 ? 0 : Math.PI;
      } else {
        ang = tipAngle(p, "horizontal-in", cx, cy);
      }
      fillPoly(ctx, tri(p.x, p.y, ang, s * 1.55, s * 0.85));
    }
  }

  /** Tessellate — tukutuku-like right-triangle mosaic. */
  _tessellate(ctx, points, shapeSize, spacing) {
    const cell = spacing * Math.min(1, shapeSize);
    for (const p of points) {
      const flip = ((p.gx ?? 0) + (p.gy ?? 0)) % 4;
      fillPoly(ctx, rightTri(p.x - cell / 2, p.y - cell / 2, cell, flip));
    }
  }

  /** Spike — elongated in/out teeth with optional breath on length. */
  _spike(ctx, points, elementScale, spacing, direction, cx, cy, elongation, time) {
    for (const p of points) {
      const s = unitSize(p, elementScale, spacing);
      const pulse = 0.85 + 0.15 * Math.sin(time * 2 + (p.id || 0) * 0.2);
      const ang = tipAngle(p, direction === "in" ? "horizontal-in" : direction === "out" ? "horizontal-out" : direction, cx, cy);
      fillPoly(ctx, tri(p.x, p.y, ang, s * elongation * 1.5 * pulse, s * 0.42));
    }
  }
}
