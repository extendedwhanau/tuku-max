/**
 * Path Engine — convert opentype commands into polylines + point-in-glyph tests.
 */

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, step) {
  const pts = [];
  const approx =
    dist(x0, y0, x1, y1) +
    dist(x1, y1, x2, y2) +
    dist(x2, y2, x3, y3);
  const n = Math.max(2, Math.ceil(approx / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x =
      u * u * u * x0 +
      3 * u * u * t * x1 +
      3 * u * t * t * x2 +
      t * t * t * x3;
    const y =
      u * u * u * y0 +
      3 * u * u * t * y1 +
      3 * u * t * t * y2 +
      t * t * t * y3;
    pts.push({ x, y });
  }
  return pts;
}

function sampleQuad(x0, y0, x1, y1, x2, y2, step) {
  const pts = [];
  const approx = dist(x0, y0, x1, y1) + dist(x1, y1, x2, y2);
  const n = Math.max(2, Math.ceil(approx / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
    const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
    pts.push({ x, y });
  }
  return pts;
}

export class PathEngine {
  /**
   * @param {object} layout from TypographyEngine.getLayout()
   * @param {number} step curve sampling step in px
   */
  build(layout, step = 3) {
    const contours = [];
    const allRings = [];

    for (const glyph of layout.paths) {
      let ring = [];
      let cx = 0;
      let cy = 0;
      const rings = [];

      for (const c of glyph.commands) {
        if (c.type === "M") {
          if (ring.length > 1) rings.push(ring);
          ring = [{ x: c.x, y: c.y }];
          cx = c.x;
          cy = c.y;
        } else if (c.type === "L") {
          ring.push({ x: c.x, y: c.y });
          cx = c.x;
          cy = c.y;
        } else if (c.type === "Q") {
          ring.push(...sampleQuad(cx, cy, c.x1, c.y1, c.x, c.y, step));
          cx = c.x;
          cy = c.y;
        } else if (c.type === "C") {
          ring.push(
            ...sampleCubic(cx, cy, c.x1, c.y1, c.x2, c.y2, c.x, c.y, step)
          );
          cx = c.x;
          cy = c.y;
        } else if (c.type === "Z") {
          if (ring.length > 1) {
            if (
              ring[0].x !== ring[ring.length - 1].x ||
              ring[0].y !== ring[ring.length - 1].y
            ) {
              ring.push({ ...ring[0] });
            }
            rings.push(ring);
          }
          ring = [];
        }
      }
      if (ring.length > 1) rings.push(ring);

      for (const r of rings) {
        contours.push(r);
        allRings.push(r);
      }
    }

    const bounds = layout.bounds;
    return {
      contours,
      bounds,
      contains: (x, y) => pointInGlyph(x, y, allRings),
      tangentAt: (x, y) => nearestTangent(x, y, allRings),
      contourPoints: flattenContours(contours, step * 2),
    };
  }
}

function flattenContours(contours, minDist) {
  const pts = [];
  for (const ring of contours) {
    let last = null;
    for (const p of ring) {
      if (!last || dist(last.x, last.y, p.x, p.y) >= minDist) {
        pts.push({ x: p.x, y: p.y, onContour: true });
        last = p;
      }
    }
  }
  return pts;
}

/** Even-odd fill rule across all rings (handles counters). */
function pointInGlyph(x, y, rings) {
  let inside = false;
  for (const ring of rings) {
    if (pointInRing(x, y, ring)) inside = !inside;
  }
  return inside;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function nearestTangent(x, y, rings) {
  let best = Infinity;
  let angle = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const d = pointSegDist(x, y, a.x, a.y, b.x, b.y);
      if (d < best) {
        best = d;
        angle = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
  }
  return { angle, dist: best };
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, ax + t * dx, ay + t * dy);
}
