/**
 * Typeface for text stitches — Die Grotesk by default, optional custom upload.
 */

import { S } from "./state.js";

export const DEFAULT_TYPEFACE_NAME = "Die Grotesk A";
export const DEFAULT_TYPEFACE_FAMILY = "Die Grotesk A";
export const DEFAULT_TYPEFACE_CSS =
  '"Die Grotesk A", -apple-system, BlinkMacSystemFont, sans-serif';

const CUSTOM_FAMILY = "TukuCustomTypeface";

/** @type {FontFace | null} */
let customFace = null;

/** Cached Die Grotesk data URI for portable SVG/PNG export */
let defaultEmbed = null;
let defaultEmbedPromise = null;

function formatFromName(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "woff2") return { format: "woff2", mime: "font/woff2" };
  if (ext === "woff") return { format: "woff", mime: "font/woff" };
  if (ext === "otf") return { format: "opentype", mime: "font/otf" };
  if (ext === "ttf") return { format: "truetype", mime: "font/ttf" };
  return { format: "truetype", mime: "font/ttf" };
}

function bufferToDataUri(buffer, mime) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function ensureDefaultEmbed() {
  if (defaultEmbed) return defaultEmbed;
  if (defaultEmbedPromise) return defaultEmbedPromise;
  defaultEmbedPromise = (async () => {
    const url = new URL(
      "../../fonts/die-grotesk-a/die-grotesk-a-medium.woff2",
      import.meta.url
    ).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not load Die Grotesk");
    const buffer = await res.arrayBuffer();
    defaultEmbed = {
      family: DEFAULT_TYPEFACE_FAMILY,
      dataUri: bufferToDataUri(buffer, "font/woff2"),
      format: "woff2",
    };
    return defaultEmbed;
  })();
  return defaultEmbedPromise;
}

export function typefaceCssStack() {
  if (S.typefaceFamily === DEFAULT_TYPEFACE_FAMILY) {
    return DEFAULT_TYPEFACE_CSS;
  }
  return `"${S.typefaceFamily}", ${DEFAULT_TYPEFACE_CSS}`;
}

/** CSS @font-face block to embed in exported SVG (async). */
export async function typefaceEmbedCss() {
  if (S.typefaceDataUri && S.typefaceFormat) {
    const fam = S.typefaceFamily.replace(/"/g, "");
    return `@font-face{font-family:"${fam}";src:url(${S.typefaceDataUri}) format("${S.typefaceFormat}");font-weight:100 900;font-style:normal;font-display:block;}`;
  }
  try {
    const emb = await ensureDefaultEmbed();
    return `@font-face{font-family:"${emb.family}";src:url(${emb.dataUri}) format("${emb.format}");font-weight:500;font-style:normal;font-display:block;}`;
  } catch {
    return "";
  }
}

export function resetTypeface() {
  if (customFace) {
    try {
      document.fonts.delete(customFace);
    } catch {
      /* ignore */
    }
    customFace = null;
  }
  S.typefaceName = DEFAULT_TYPEFACE_NAME;
  S.typefaceFamily = DEFAULT_TYPEFACE_FAMILY;
  S.typefaceDataUri = null;
  S.typefaceFormat = null;
}

/**
 * Load a user font file (ttf / otf / woff / woff2).
 * @param {File} file
 */
export async function loadTypefaceFile(file) {
  const buffer = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, "") || "Custom";
  const { format, mime } = formatFromName(file.name);

  if (customFace) {
    try {
      document.fonts.delete(customFace);
    } catch {
      /* ignore */
    }
    customFace = null;
  }

  const face = new FontFace(CUSTOM_FAMILY, buffer);
  await face.load();
  document.fonts.add(face);
  customFace = face;

  S.typefaceName = name;
  S.typefaceFamily = CUSTOM_FAMILY;
  S.typefaceDataUri = bufferToDataUri(buffer, mime);
  S.typefaceFormat = format;
  return { name, family: CUSTOM_FAMILY };
}

/** Warm the default embed cache in the background. */
export function prefetchDefaultTypeface() {
  ensureDefaultEmbed().catch(() => {});
}
