import type { PreviewJsonResponse, IngestJsonResponse } from "@/types/orders";

export interface PreviewResponse {
  ok?: boolean;
  unknown?: string[];
  orders?: any[];
  error?: string | null;
}

export async function parsePreviewStrict(apiBase: string, files: File[]): Promise<PreviewJsonResponse> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  const res = await fetch(`${apiBase}/parse-preview`, { method: "POST", body: fd });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const err = ct.includes("application/json") ? JSON.stringify(await res.json(), null, 2) : await res.text();
    throw new Error(err);
  }
  return (await res.json()) as PreviewResponse;
}

export async function ingestStrict(
  apiBase: string,
  files: File[],
  mappingObj: Record<string, string>
): Promise<IngestJsonResponse> {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  if (mappingObj && Object.keys(mappingObj).length) fd.append("mapping", JSON.stringify(mappingObj));
  fd.append("mode","json");
  // Use local API route (TS parser) instead of external Python API
  const res = await fetch(`/api/ingest`, { method: "POST", body: fd });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const err = ct.includes("application/json") ? JSON.stringify(await res.json(), null, 2) : await res.text();
    throw new Error(err);
  }
  return (await res.json()) as IngestJsonResponse;
}
