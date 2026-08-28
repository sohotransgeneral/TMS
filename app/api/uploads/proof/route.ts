import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { uploadPrivate, getSignedDownloadUrl } from "@/lib/r2";

/**
 * Receipts and screenshots attached to payroll adjustments.
 *
 * R2 rather than lib/storage.ts: that falls back to writing into public/uploads
 * when BLOB_READ_WRITE_TOKEN is unset, and the filesystem is read-only in
 * production — which is how accessorial receipts were being lost silently.
 *
 * POST returns the object key; GET ?key=... exchanges it for a signed URL.
 */

const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const PREFIX = "proofs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    await requirePermission("users:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { key } = await uploadPrivate(buffer, file.name, PREFIX);
    return NextResponse.json({ ok: true, url: key, name: file.name });
  } catch (err) {
    console.error("[uploads/proof] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("reports:read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  // Only hand out keys this route wrote.
  if (!key.startsWith(`${PREFIX}/`)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    return NextResponse.json({ url: await getSignedDownloadUrl(key, 3600) });
  } catch {
    return NextResponse.json({ error: "Could not open document" }, { status: 500 });
  }
}
