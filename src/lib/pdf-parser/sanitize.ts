/**
 * sanitize.ts — Port of core/sanitize.py + parsing/parse_items.py cleaning
 *
 * Note: pdfjs-dist returns text in correct reading order,
 * so rtl_line() / _fix_numbers_rtl() are NOT needed here.
 */

// Invisible / bidi control characters to strip
const CTRL_BIDI = [
  "\u200b", "\u200c", "\u200d", "\ufeff", "\u200e", "\u200f",
  "\u202a", "\u202b", "\u202c", "\u202d", "\u202e",
  "\u2066", "\u2067", "\u2068", "\u2069", "\u2060",
];

// Non-breaking / thin spaces → regular space
const WS_SPECIAL = ["\u00a0", "\u202f", "\u2009"];

// Smart punctuation → ASCII
const PUNCT_MAP: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u02B9": "'", "\u05F3": "'", // curly quotes → '
  "\u201C": '"', "\u201D": '"',  // curly double → "
  "\u05F4": '"',                 // Hebrew gershayim → "
  "\u2013": "-", "\u2014": "-", "\u05BE": "-",  // dashes → -
};

const ctrlBidiRe = new RegExp(`[${CTRL_BIDI.map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")}]`, "g");
const wsSpecialRe = new RegExp(`[${WS_SPECIAL.map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")}]`, "g");

/** Full sanitize: NFKC + strip bidi + normalize whitespace */
export function sanitizeText(s: string): string {
  s = (s || "").normalize("NFKC");
  // strip bidi controls
  s = s.replace(ctrlBidiRe, "");
  // tabs → space
  s = s.replace(/\t/g, " ");
  // collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

/** Soft normalize: punctuation unification + collapse whitespace (used for matching) */
export function normalizeSoft(s: string): string {
  if (s == null) return "";
  s = String(s);
  for (const [k, v] of Object.entries(PUNCT_MAP)) {
    s = s.split(k).join(v);
  }
  return s.split(/\s+/).join(" ").trim();
}

/** Clean text for parse_items: punctuation + bidi + ILS→₪ + collapse whitespace */
export function clean(s: string): string {
  s = s || "";
  // punctuation normalization
  for (const [k, v] of Object.entries(PUNCT_MAP)) {
    s = s.split(k).join(v);
  }
  // strip bidi controls
  s = s.replace(ctrlBidiRe, "");
  // special whitespace → regular space
  s = s.replace(wsSpecialRe, " ");
  // ILS → ₪
  s = s.replace(/ILS/g, "₪").replace(/₪₪/g, "₪");
  // collapse whitespace
  return s.replace(/[ \t]+/g, " ").trim();
}
