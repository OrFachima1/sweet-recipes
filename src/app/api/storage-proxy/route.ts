import { NextRequest, NextResponse } from "next/server";

const BUCKET = "sweetrecipes-11c47.firebasestorage.app";

// Server-side proxy for Firebase Storage downloads.
// Browser fetch to Firebase Storage is blocked by CORS; server fetch is not.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "auth required" }, { status: 401 });

  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;

  const upstream = await fetch(url, { headers: { Authorization: authHeader } });
  if (!upstream.ok) {
    return NextResponse.json({ error: `storage ${upstream.status}` }, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(buffer, { headers: { "Content-Type": contentType } });
}
