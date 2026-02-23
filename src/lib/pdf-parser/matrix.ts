/**
 * matrix.ts — Port of parsing/matrix.py
 *
 * Builds a product × client matrix from parsed PDF results.
 */

import { extractFromPdf, type PdfExtractResult } from "./pdfExtract";
import { parseItems, type ParsedItem } from "./parseItems";

export interface MatrixResult {
  /** product → client → qty */
  matrix: Map<string, Map<string, number>>;
  /** client → ISO date string */
  clientDate: Map<string, string>;
  /** client → [{ product, note }] */
  notesByClient: Map<string, { product: string; note: string }[]>;
}

export async function buildMatrixFromPdfs(buffers: ArrayBuffer[]): Promise<MatrixResult> {
  const matrix = new Map<string, Map<string, number>>();
  const clientDate = new Map<string, string>();
  const notesByClient = new Map<string, { product: string; note: string }[]>();

  for (const buf of buffers) {
    const { lines, client, eventDate } = await extractFromPdf(buf);

    if (eventDate && !clientDate.has(client)) {
      clientDate.set(client, eventDate);
    }

    const { items, notes } = parseItems(lines);

    // Fill matrix
    for (const { title, qty } of items) {
      if (!matrix.has(title)) {
        matrix.set(title, new Map());
      }
      const clientMap = matrix.get(title)!;
      clientMap.set(client, (clientMap.get(client) ?? 0) + qty);
    }

    // Collect notes
    if (Object.keys(notes).length) {
      if (!notesByClient.has(client)) {
        notesByClient.set(client, []);
      }
      const clientNotes = notesByClient.get(client)!;
      for (const [product, noteText] of Object.entries(notes)) {
        const trimmed = (noteText || "").trim();
        if (trimmed) {
          clientNotes.push({ product, note: trimmed });
        }
      }
    }
  }

  return { matrix, clientDate, notesByClient };
}

/**
 * Convert matrix result to the IngestJsonResponse format
 * (same JSON shape as Python api_server.py _orders_json_from_matrix)
 */
export function matrixToOrdersJson(result: MatrixResult) {
  const { matrix, clientDate, notesByClient } = result;

  // Collect all clients
  const clientsSet = new Set<string>();
  for (const clientMap of matrix.values()) {
    for (const c of clientMap.keys()) {
      clientsSet.add(c);
    }
  }

  const clients = Array.from(clientsSet).sort((a, b) => a.localeCompare(b, "he"));

  const orders = clients.map(c => {
    const items: { title: string; qty: number }[] = [];
    for (const [product, clientMap] of matrix.entries()) {
      const q = clientMap.get(c) ?? 0;
      if (q) {
        items.push({ title: product, qty: Number.isInteger(q) ? q : q });
      }
    }

    // Notes for this client as string array
    const clientNotes = notesByClient.get(c) ?? [];
    const orderNotes = clientNotes.length
      ? clientNotes.map(n => `${n.product}: ${n.note}`)
      : null;

    const eventDate = clientDate.get(c) ?? null;

    return {
      orderId: null,
      clientName: c,
      eventDate,
      status: "confirmed",
      items,
      orderNotes,
      totalSum: null,
      currency: null,
      source: "pdf-import",
      meta: {},
    };
  });

  return { orders };
}
