/**
 * parseItems.ts — Port of parsing/parse_items.py
 *
 * Bottom-up state machine that classifies lines as:
 *   TN  = text + numbers + ₪  (product name with qty/price inline)
 *   N   = numbers + ₪          (qty + price only)
 *   T   = plain text            (product name or note)
 *   NOISE / HEADER              (skip)
 *
 * Key difference from Python: pdfjs-dist returns numbers in correct order
 * ("110.17₪" not "17.110₪") and may have a space before ₪ ("110.17 ₪").
 * Regex patterns use \s*₪ to handle both cases.
 */

import { clean } from "./sanitize";

// ── Config ──
const STRICT_SHEKEL = true;

// ── Header / Noise detection ──

function isHeaderLine(s: string): boolean {
  const c = clean(s);
  return c.includes("מוצר") && c.includes("סה");
}

const NOISE_PATTERNS = [
  'מסמך ממוחשב זה הופק באמצעות', 'סה"כ ללא מע"מ', 'מע"מ',
  'סה"כ לתשלום', 'סה"כ', "חתימה", "אופן העברת התשלום",
  "מוטב:", "בית עוזיאל", "לכבוד:",
  "קונדטוריה למגשי", "עוסק מורשה", "עמוד ",
  "הנחה", "משלוח", "מספר קטלוגי:",
];

function isNoiseLine(s: string): boolean {
  const c = clean(s);
  if (!c) return true;
  return NOISE_PATTERNS.some(p => c.includes(p));
}

function hasShekel(s: string): boolean {
  return (s || "").includes("₪");
}

// ── Anchor regex patterns ──
// _NUM matches flexible numbers: "1,234.56" or "110.17" etc.
const _NUM = String.raw`(?:\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?`;

// N:  qty  unitPrice  total₪   — group[1]=qty
const RE_N = new RegExp(String.raw`^\s*(\d+)\s+${_NUM}\s+${_NUM}\s*₪\s*$`);

// TN: text  qty  unitPrice  total₪ — group[1]=pre, group[2]=qty
const RE_TN = new RegExp(String.raw`^(.+?)\s+(\d+)\s+${_NUM}\s+${_NUM}\s*₪\s*$`);

// P:  price₪ only (single number)
const RE_P = new RegExp(String.raw`^\s*${_NUM}\s*₪\s*$`);

// TP: text  price₪ — group[1]=pre
const RE_TP = new RegExp(String.raw`^(.+?)\s+${_NUM}\s*₪\s*$`);

type LineKind = "TN" | "N" | "T" | "NOISE" | "HEADER" | "USED" | "USED_NOTE";

function classifyRaw(s: string): LineKind {
  if (isHeaderLine(s)) return "HEADER";
  if (RE_TN.test(s)) return "TN";
  if (RE_N.test(s)) return "N";
  if (RE_P.test(s)) return "N";   // P ≡ N
  if (RE_TP.test(s)) return "TN"; // TP ≡ TN
  if (isNoiseLine(s)) return "NOISE";
  return "T";
}

function classify(s: string): LineKind {
  const c = clean(s);
  let kind = classifyRaw(c);

  // משלוח/הובלה/סה"כ/הנחה → NOISE even if TN
  if (kind === "TN") {
    const m = RE_TN.exec(c) || RE_TP.exec(c);
    const pre = m ? m[1] : "";
    if (["משלוח", "דמי משלוח", "הובלה", 'סה"כ', "הנחה"].some(k => pre.includes(k))) {
      kind = "NOISE";
    }
  }

  // ₪ guard: N/TN must have ₪
  if (STRICT_SHEKEL && (kind === "TN" || kind === "N") && !hasShekel(c)) {
    kind = "T";
  }

  return kind;
}

function qtyFromNLine(s: string): number {
  const c = clean(s);
  const m = RE_N.exec(c);
  if (m && m[1]) return parseInt(m[1], 10);  // group[1]=qty
  if (RE_P.test(c)) return 1;
  return 1;
}

function qtyFromTNLine(s: string): number {
  const c = clean(s);
  const m = RE_TN.exec(c);
  if (m && m[2]) return parseInt(m[2], 10);  // group[2]=qty
  if (RE_TP.test(c)) return 1; // TP: no explicit qty
  return 1;
}

function splitTNPre(s: string): string {
  const c = clean(s);
  const m = RE_TN.exec(c);
  if (m && m[1]) return clean(m[1]);  // group[1]=pre
  const m2 = RE_TP.exec(c);
  if (m2 && m2[1]) return clean(m2[1]);  // group[1]=pre
  return "";
}

// ── Main parser ──

export interface ParsedItem {
  title: string;
  qty: number;
}

export interface ParseResult {
  items: ParsedItem[];
  notes: Record<string, string>;
}

export function parseItems(lines: string[]): ParseResult {
  const items: ParsedItem[] = [];
  const notes: Record<string, string> = {};

  // Find table header — only process lines after it
  let headerIdx = 0;
  for (let idx = 0; idx < lines.length; idx++) {
    if (isHeaderLine(lines[idx])) {
      headerIdx = idx + 1;
      break;
    }
  }

  const tableLines = lines.slice(headerIdx);

  // Build cleaned pairs, filtering noise
  const allPairs: { idx: number; s: string }[] = [];
  for (let i = 0; i < tableLines.length; i++) {
    const s = clean(tableLines[i]);
    if (s) {
      const k = classify(s);
      if (k !== "NOISE" && k !== "HEADER") {
        allPairs.push({ idx: i, s });
      }
    }
  }

  const S = allPairs.map(p => p.s);
  const K: LineKind[] = S.map(s => classify(s));
  const n = K.length;
  const start = 0;

  function addItem(
    prodIdx: number | null,
    qty: number | null,
    noteLines: string[],
    anchorIdx: number,
    _tag: string
  ) {
    const title =
      prodIdx !== null && prodIdx >= start
        ? S[prodIdx]
        : `<unknown@${anchorIdx}>`;
    const q = qty ?? 1;
    items.push({ title, qty: q });
    if (noteLines.length) {
      const block = noteLines.map(x => clean(x)).filter(Boolean).join(" ");
      if (block) {
        notes[title] = block;
      }
    }
  }

  // Bottom-up scan
  let i = n - 1;
  while (i >= start) {
    const k = K[i];
    const s = S[i];

    if (["NOISE", "HEADER", "USED", "USED_NOTE"].includes(k) || !s) {
      i--;
      continue;
    }

    // TN: always a standalone product
    if (k === "TN") {
      const title = splitTNPre(S[i]);
      const qty = qtyFromTNLine(S[i]);
      if (title) {
        items.push({ title, qty });
        K[i] = "USED";
      }
      i--;
      continue;
    }

    // N: fallback — T above = product, optional T below = note
    if (k === "N") {
      let made = false;
      const prodIdx = i - 1;
      if (prodIdx >= start && K[prodIdx] === "T") {
        const qty = qtyFromNLine(S[i]);
        const noteLines: string[] = [];
        if (i + 1 < n && K[i + 1] === "T") {
          noteLines.push(S[i + 1]);
        }
        addItem(prodIdx, qty, noteLines, i, `fallback N@${i}`);
        K[prodIdx] = "USED";
        K[i] = "USED";
        if (i + 1 < n && K[i + 1] === "T") {
          K[i + 1] = "USED_NOTE";
        }
        i = prodIdx - 1;
        made = true;
      }
      if (!made) {
        i--;
      }
      continue;
    }

    // T: collect notes upward until anchor (N/TN)
    if (k === "T") {
      const noteBuf: string[] = [S[i]];
      const noteIdxBuf: number[] = [i];

      let j = i - 1;
      let broke = false;
      while (j >= start) {
        if (["NOISE", "HEADER", "USED", "USED_NOTE"].includes(K[j]) || !S[j]) {
          j--;
          continue;
        }

        if (K[j] === "T") {
          noteBuf.unshift(S[j]);
          noteIdxBuf.unshift(j);
          j--;
          continue;
        }

        // Found anchor
        if (K[j] === "N" || K[j] === "TN") {
          let prodIdx = j - 1;
          if (prodIdx < start || K[prodIdx] !== "T") {
            i = prodIdx;
            broke = true;
            break;
          }

          let qty: number;
          if (K[j] === "TN") {
            const pre = splitTNPre(S[j]);
            if (pre) {
              noteBuf.unshift(pre);
            }
            qty = qtyFromTNLine(S[j]);
          } else {
            // N anchor
            if (noteBuf.length >= 2 && j - 2 >= start && K[j - 2] === "T") {
              prodIdx = j - 2;
              if (K[j - 1] === "T") {
                noteBuf.unshift(S[j - 1]);
                noteIdxBuf.unshift(j - 1);
              }
            }
            qty = qtyFromNLine(S[j]);
          }

          addItem(prodIdx, qty, noteBuf, j, `T-run@${i}+anchor@${j}`);
          K[prodIdx] = "USED";
          K[j] = "USED";
          for (const idx of noteIdxBuf) {
            K[idx] = "USED_NOTE";
          }
          i = prodIdx - 1;
          broke = true;
          break;
        }

        // Unexpected kind — stop run
        i = j - 1;
        broke = true;
        break;
      }

      if (!broke) {
        // No anchor found — skip
        i--;
      }
      continue;
    }

    // Default
    i--;
  }

  // Return in natural order (top to bottom)
  items.reverse();
  return { items, notes };
}
