/**
 * Typography Engine — multi-line layout that wraps inside a frame.
 */

const DEFAULT_FONT_URL = new URL("../fonts/SourceSans3.ttf", import.meta.url).href;

export class TypographyEngine {
  constructor() {
    this.font = null;
    this.fontName = "Source Sans 3";
  }

  async loadDefault() {
    return this.loadFromUrl(DEFAULT_FONT_URL, "Source Sans 3");
  }

  async loadFromUrl(url, name = "Custom") {
    const buffer = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`);
      return r.arrayBuffer();
    });
    this.font = opentype.parse(buffer);
    this.fontName = name;
    return this.font;
  }

  async loadFromFile(file) {
    const buffer = await file.arrayBuffer();
    this.font = opentype.parse(buffer);
    this.fontName = file.name.replace(/\.[^.]+$/, "");
    return this.font;
  }

  measureGlyphWidth(glyph, fontSize) {
    return (glyph.advanceWidth / this.font.unitsPerEm) * fontSize;
  }

  /**
   * Wrap text into lines that fit maxWidth.
   * Honours explicit newlines; otherwise breaks on spaces, then characters.
   */
  wrapLines(text, fontSize, tracking, maxWidth) {
    const rawLines = String(text || " ").replace(/\r/g, "").split("\n");
    const lines = [];

    for (const raw of rawLines) {
      if (raw.length === 0) {
        lines.push("");
        continue;
      }
      const words = raw.split(/(\s+)/);
      let current = "";
      for (const word of words) {
        if (!word) continue;
        const trial = current + word;
        const w = this.measureString(trial, fontSize, tracking);
        if (current && w > maxWidth) {
          lines.push(current.replace(/\s+$/, ""));
          current = word.replace(/^\s+/, "");
          // Hard-break overlong tokens
          while (this.measureString(current, fontSize, tracking) > maxWidth && current.length > 1) {
            let cut = current.length - 1;
            while (
              cut > 1 &&
              this.measureString(current.slice(0, cut), fontSize, tracking) > maxWidth
            ) {
              cut--;
            }
            lines.push(current.slice(0, cut));
            current = current.slice(cut);
          }
        } else {
          current = trial;
        }
      }
      lines.push(current.replace(/\s+$/, ""));
    }

    return lines.length ? lines : [""];
  }

  measureString(str, fontSize, tracking) {
    if (!this.font || !str) return 0;
    const glyphs = this.font.stringToGlyphs(str);
    let w = 0;
    for (let i = 0; i < glyphs.length; i++) {
      w += this.measureGlyphWidth(glyphs[i], fontSize);
      if (i < glyphs.length - 1) w += tracking;
    }
    return w;
  }

  lineHeight(fontSize, leading) {
    return fontSize * leading;
  }

  /**
   * Find largest fontSize where wrapped text fits in frameW × frameH.
   */
  fitFontSize(text, frameW, frameH, { tracking = 0, leading = 1.15, min = 12, max = 400 } = {}) {
    if (!this.font) return min;
    let lo = min;
    let hi = max;
    let best = min;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const lines = this.wrapLines(text, mid, tracking, frameW);
      const h = lines.length * this.lineHeight(mid, leading);
      const widest = Math.max(0, ...lines.map((l) => this.measureString(l, mid, tracking)));
      if (h <= frameH && widest <= frameW + 0.5) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return Math.floor(best);
  }

  /**
   * Layout text inside a frame centred on origin.
   * Frame is [-frameW/2, frameW/2] × [-frameH/2, frameH/2].
   */
  getLayout({
    text = "H",
    fontSize = 120,
    tracking = 0,
    leading = 1.15,
    frameW = 400,
    frameH = 400,
    align = "center",
    autoFit = true,
  } = {}) {
    if (!this.font) return { paths: [], bounds: null, lines: [], fontSize: 0 };

    let size = fontSize;
    if (autoFit) {
      size = this.fitFontSize(text, frameW, frameH, { tracking, leading, max: fontSize });
    }

    const lines = this.wrapLines(text, size, tracking, frameW);
    const lh = this.lineHeight(size, leading);
    const blockH = lines.length * lh;
    const ascender = (this.font.ascender / this.font.unitsPerEm) * size;
    // Top of first baseline block, centred in frame
    let baseline = -blockH / 2 + ascender * 0.75;

    const laid = [];

    for (const line of lines) {
      const lineW = this.measureString(line, size, tracking);
      let x0 = -frameW / 2;
      if (align === "center") x0 = -lineW / 2;
      else if (align === "right") x0 = frameW / 2 - lineW;

      let x = x0;
      const glyphs = this.font.stringToGlyphs(line || " ");
      for (let i = 0; i < glyphs.length; i++) {
        const glyph = glyphs[i];
        const path = glyph.getPath(x, baseline, size);
        laid.push({
          glyph,
          commands: path.commands.map((c) => ({ ...c })),
          x,
          y: baseline,
          advance: this.measureGlyphWidth(glyph, size),
        });
        x += this.measureGlyphWidth(glyph, size) + tracking;
      }
      baseline += lh;
    }

    const bounds = this._bounds(laid);
    return {
      paths: laid,
      bounds: bounds || {
        minX: -frameW / 2,
        maxX: frameW / 2,
        minY: -frameH / 2,
        maxY: frameH / 2,
      },
      lines,
      fontSize: size,
      frame: { w: frameW, h: frameH },
    };
  }

  _bounds(laid) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;

    for (const g of laid) {
      for (const c of g.commands) {
        for (const [xKey, yKey] of [
          ["x", "y"],
          ["x1", "y1"],
          ["x2", "y2"],
        ]) {
          if (c[xKey] != null && c[yKey] != null) {
            found = true;
            minX = Math.min(minX, c[xKey]);
            maxX = Math.max(maxX, c[xKey]);
            minY = Math.min(minY, c[yKey]);
            maxY = Math.max(maxY, c[yKey]);
          }
        }
      }
    }

    if (!found) return null;
    return { minX, minY, maxX, maxY };
  }
}
