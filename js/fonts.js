/**
 * Font loading via FontFace API (canvas text raster).
 */

import { S } from "./state.js";

const DEFAULT_URL = new URL("../fonts/SourceSans3.ttf", import.meta.url).href;

let face = null;

export async function loadDefaultFont() {
  const buf = await fetch(DEFAULT_URL).then((r) => {
    if (!r.ok) throw new Error("Font fetch failed");
    return r.arrayBuffer();
  });
  return loadFontBuffer(buf, "Source Sans 3");
}

export async function loadFontFile(file) {
  const buf = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, "");
  return loadFontBuffer(buf, name);
}

async function loadFontBuffer(buffer, name) {
  if (face) {
    try {
      document.fonts.delete(face);
    } catch (_) {}
  }
  face = new FontFace("GTLFont", buffer);
  await face.load();
  document.fonts.add(face);
  S.fontFamily = "GTLFont";
  S.fontName = name;
  return face;
}

export function fontCSS() {
  return `"${S.fontFamily}", system-ui, sans-serif`;
}
