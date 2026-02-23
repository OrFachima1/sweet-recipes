import { NextRequest, NextResponse } from "next/server";
import { buildMatrixFromPdfs, matrixToOrdersJson } from "@/lib/pdf-parser";
import { normalizeSoft } from "@/lib/pdf-parser/sanitize";

export const runtime = "nodejs";

const MAX_FILE_SIZE_MB = 50;
const MAX_TOTAL_MB = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const mappingRaw = formData.get("mapping") as string | null;
    const mode = (formData.get("mode") as string) ?? "json";

    if (!files.length) {
      return NextResponse.json(
        { error: "no-files", message: "לא נשלחו קבצים." },
        { status: 400 }
      );
    }

    // Validate sizes
    let totalMB = 0;
    const buffers: ArrayBuffer[] = [];

    for (const file of files) {
      const sizeMB = file.size / (1024 * 1024);
      totalMB += sizeMB;

      if (sizeMB > MAX_FILE_SIZE_MB) {
        return NextResponse.json(
          { error: "file-too-large", message: `${file.name} גדול מדי (${sizeMB.toFixed(1)}MB> ${MAX_FILE_SIZE_MB}MB)` },
          { status: 400 }
        );
      }
      if (totalMB > MAX_TOTAL_MB) {
        return NextResponse.json(
          { error: "request-too-large", message: `סך הקבצים חורג מהמגבלה (${totalMB.toFixed(1)}MB> ${MAX_TOTAL_MB}MB)` },
          { status: 400 }
        );
      }

      buffers.push(await file.arrayBuffer());
    }

    // Parse mapping
    let mapping: Record<string, string> = {};
    if (mappingRaw) {
      try {
        const parsed = JSON.parse(mappingRaw);
        if (typeof parsed === "object" && parsed !== null) {
          mapping = parsed;
        }
      } catch {
        return NextResponse.json(
          { error: "bad-mapping", message: "mapping אינו JSON חוקי" },
          { status: 400 }
        );
      }
    }

    // Build matrix from all PDFs
    const matrixResult = await buildMatrixFromPdfs(buffers);

    // Apply mapping aliases to matrix
    if (Object.keys(mapping).length) {
      for (const [src, dst] of Object.entries(mapping)) {
        const normSrc = normalizeSoft(src);
        const normDst = dst; // dst should already be canonical
        // Rename products in matrix
        if (matrixResult.matrix.has(normSrc)) {
          const srcMap = matrixResult.matrix.get(normSrc)!;
          const dstMap = matrixResult.matrix.get(normDst) ?? new Map<string, number>();
          for (const [client, qty] of srcMap.entries()) {
            dstMap.set(client, (dstMap.get(client) ?? 0) + qty);
          }
          matrixResult.matrix.set(normDst, dstMap);
          matrixResult.matrix.delete(normSrc);
        }
      }
    }

    if (mode === "json") {
      const result = matrixToOrdersJson(matrixResult);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "bad-mode", message: "mode חייב להיות 'json'" },
      { status: 400 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[/api/ingest] Error:", message);
    return NextResponse.json(
      { error: "internal", message },
      { status: 500 }
    );
  }
}
