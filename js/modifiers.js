/**
 * Modifier System — keep transforms optional and non-destructive by default.
 * MuirMcNeil systems prefer locked positions; motion should be calibrated, not organic.
 */

function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x, y) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const a = hash(i + j * 57);
  const b = hash(i + 1 + j * 57);
  const c = hash(i + (j + 1) * 57);
  const d = hash(i + 1 + (j + 1) * 57);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export class ModifierSystem {
  apply(points, state) {
    const {
      time = 0,
      breath = false,
      wave = false,
      noise = false,
      mouse = false,
      mouseX = 0,
      mouseY = 0,
      speed = 1,
      cx = 0,
      cy = 0,
      weightPulse = false,
    } = state;

    const t = time * speed;
    // Uniform weight pulse — all units share one scale (system weight)
    const sharedScale = weightPulse
      ? 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 1.8))
      : 1;

    return points.map((p, i) => {
      let x = p.x;
      let y = p.y;
      let scale = sharedScale;
      let rotation = 0;
      let alpha = 1;

      if (breath) {
        const phase = t * 1.4 + i * 0.07;
        scale *= 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(phase));
      }

      if (wave) {
        // Calibrated vertical shift only — preserves column lock
        y += Math.sin(t * 2 + (p.gx ?? i) * 0.35) * 2.5;
      }

      if (noise) {
        const n = noise2(x * 0.01 + t * 0.15, y * 0.01 - t * 0.1);
        x += (n - 0.5) * 4;
        y += (noise2(y * 0.01, x * 0.01 + t * 0.12) - 0.5) * 4;
      }

      if (mouse) {
        const dx = x + cx - mouseX;
        const dy = y + cy - mouseY;
        const d = Math.hypot(dx, dy) + 1;
        const fall = Math.exp(-d * 0.014);
        scale *= 1 + fall * 0.45;
      }

      return {
        ...p,
        x,
        y,
        scale,
        rotation,
        alpha,
        ox: p.x,
        oy: p.y,
      };
    });
  }
}
