/**
 * Sampler — strict pixel grid. No jitter. Integer cell sizes.
 */

export class Sampler {
  /**
   * @param {object} pathData
   * @param {{ cellSize?: number, mode?: string, frame?: {w:number,h:number} }} opts
   */
  sample(pathData, { cellSize = 12, mode = "grid", frame = null } = {}) {
    const cell = Math.max(2, Math.round(cellSize));
    const bounds = pathData.bounds;
    if (!bounds) return { points: [], spacing: cell, cell };

    let points = [];
    if (mode === "contour") {
      points = this._contour(pathData, cell);
    } else {
      points = this._pixelGrid(pathData, cell, frame);
    }

    points.forEach((p, i) => {
      const t = pathData.tangentAt(p.x, p.y);
      p.angle = t.angle;
      p.edgeDist = t.dist;
      p.id = i;
    });

    return { points, spacing: cell, cell };
  }

  _pixelGrid(pathData, cell, frame) {
    const { minX, minY, maxX, maxY } = pathData.bounds;
    // Expand scan to frame if provided, still clip to glyph fill
    let x0 = Math.floor(minX / cell) * cell;
    let y0 = Math.floor(minY / cell) * cell;
    let x1 = Math.ceil(maxX / cell) * cell;
    let y1 = Math.ceil(maxY / cell) * cell;

    if (frame) {
      x0 = Math.min(x0, Math.floor((-frame.w / 2) / cell) * cell);
      y0 = Math.min(y0, Math.floor((-frame.h / 2) / cell) * cell);
      x1 = Math.max(x1, Math.ceil((frame.w / 2) / cell) * cell);
      y1 = Math.max(y1, Math.ceil((frame.h / 2) / cell) * cell);
    }

    const pts = [];
    let gy = 0;
    for (let y = y0; y <= y1; y += cell) {
      let gx = 0;
      for (let x = x0; x <= x1; x += cell) {
        // Sample cell centre for containment — regular pixel lattice
        const px = x + cell / 2;
        const py = y + cell / 2;
        if (pathData.contains(px, py)) {
          pts.push({ x: px, y: py, gx, gy, cellX: x, cellY: y });
        }
        gx++;
      }
      gy++;
    }
    return pts;
  }

  _contour(pathData, cell) {
    const pts = [];
    let i = 0;
    let last = null;
    for (const p of pathData.contourPoints) {
      // Snap contour samples onto pixel centres
      const sx = Math.round(p.x / cell) * cell + cell / 2;
      const sy = Math.round(p.y / cell) * cell + cell / 2;
      if (last && Math.hypot(sx - last.x, sy - last.y) < cell * 0.5) continue;
      if (!pathData.contains(sx, sy) && !pathData.contains(p.x, p.y)) continue;
      pts.push({
        x: sx,
        y: sy,
        gx: i,
        gy: 0,
        onContour: true,
      });
      last = { x: sx, y: sy };
      i++;
    }
    return pts;
  }
}
