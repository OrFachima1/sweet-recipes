/**
 * pdfExtract.ts — Port of parsing/pdf_io.py
 *
 * Extracts text lines, client name, and date from PDF buffers using pdfjs-dist.
 *
 * Key difference from Python: pdfjs-dist returns text in correct reading order
 * (no RTL reversal needed). We reconstruct lines by grouping text items by
 * Y coordinate and sorting by X descending (RTL).
 */

// pdfjs-dist legacy build works in Node.js without canvas
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// ── Regex patterns (no named groups — ES2017 target) ──

/** Client name: "לכבוד: <name> שובל בוטיק בייקרי" (space before colon optional) */
const CLIENT_RE = /^לכבוד\s*:\s*(.+?)\s+שובל\s+בוטיק\s+בייקרי\s*$/;

/** Free date: DD/MM or DD.MM — groups: [1]=a, [2]=b */
const FREE_DATE_RE = /\b(\d{1,2})[./](\d{1,2})\b/g;

/** Table header: contains "מוצר" and "סה" */
const HEADER_RE = /מוצר.*סה/;

// ── Line reconstruction from pdfjs-dist text items ──

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
}

const Y_TOLERANCE = 3; // pixels — items within this range are on the same line

function reconstructLines(items: TextItem[]): string[] {
  if (!items.length) return [];

  // Group by Y coordinate (with tolerance)
  const groups: { y: number; items: { x: number; str: string }[] }[] = [];

  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const str = item.str;
    if (!str && str !== "0") continue;

    // Find existing group within tolerance
    let found = false;
    for (const g of groups) {
      if (Math.abs(g.y - y) <= Y_TOLERANCE) {
        g.items.push({ x, str });
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ y, items: [{ x, str }] });
    }
  }

  // Sort groups by Y descending (top of page = higher Y in PDF coordinates)
  groups.sort((a, b) => b.y - a.y);

  // Within each group, sort items by X descending (RTL: rightmost first)
  const lines: string[] = [];
  for (const g of groups) {
    g.items.sort((a, b) => b.x - a.x);
    let line = g.items.map(i => i.str).join(" ").replace(/\s+/g, " ").trim();

    // Fix reversed decimal numbers in price lines.
    // X-descending sort reverses number fragments: "59 . 135 ₪" should be "135.59 ₪".
    // Pattern: decimal_digits SPACE.SPACE integer_digits → swap to integer.decimal
    if (line.includes("₪")) {
      line = line.replace(/(\d+)\s+\.\s+(\d+)/g, "$2.$1");
    }

    if (line) lines.push(line);
  }

  return lines;
}

// ── Main extraction ──

export interface PdfExtractResult {
  lines: string[];
  client: string;
  eventDate: string | null; // ISO date string YYYY-MM-DD
  dateLine: string | null;  // raw line where date was found (for debug)
}

export async function extractFromPdf(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const allLines: string[] = [];
  const page1Lines: string[] = [];

  for (let pageIdx = 1; pageIdx <= doc.numPages; pageIdx++) {
    const page = await doc.getPage(pageIdx);
    const content = await page.getTextContent();
    const items = (content.items as TextItem[]).filter(
      (it: TextItem) => it.str !== undefined
    );
    const pageLines = reconstructLines(items);

    allLines.push(...pageLines);
    if (pageIdx === 1) {
      page1Lines.push(...pageLines);
    }
  }

  // Remove last 7 lines (common footer)
  const lines = allLines.length > 7 ? allLines.slice(0, -7) : [...allLines];

  // ── Client name: scan all page 1 lines ──
  let client = "ללא שם לקוח";
  for (const ln of page1Lines) {
    const m = CLIENT_RE.exec(ln.trim());
    if (m && m[1]) {
      client = m[1].trim();
      break;
    }
  }

  // ── Date: line before table header ──
  let dateLine: string | null = null;
  let headerIdx: number | null = null;
  for (let i = 0; i < page1Lines.length; i++) {
    if (HEADER_RE.test(page1Lines[i])) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx !== null && headerIdx > 0) {
    dateLine = page1Lines[headerIdx - 1].trim();
  }

  // Search for date
  let eventDate: string | null = null;
  let searchLines: string[] = dateLine ? [dateLine] : [];
  if (!searchLines.length) {
    const upper = headerIdx ?? page1Lines.length;
    searchLines = page1Lines.slice(0, upper).map(l => l.trim());
  }

  for (const ln of searchLines) {
    if (!ln) continue;
    FREE_DATE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FREE_DATE_RE.exec(ln)) !== null) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (a >= 1 && a <= 31 && b >= 1 && b <= 31) {
        let day: number, month: number;
        if (a > 12 && b <= 12) {
          day = a; month = b;
        } else if (b > 12 && a <= 12) {
          day = b; month = a;
        } else {
          day = a; month = b;
        }
        const year = new Date().getFullYear();
        // Validate the date
        const d = new Date(year, month - 1, day);
        if (d.getMonth() === month - 1 && d.getDate() === day) {
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          eventDate = `${year}-${mm}-${dd}`;
          break;
        }
      }
    }
    if (eventDate) break;
  }

  return { lines, client, eventDate, dateLine };
}
