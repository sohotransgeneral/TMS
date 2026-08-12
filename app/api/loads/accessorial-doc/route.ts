import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { uploadPrivate, getSignedDownloadUrl } from "@/lib/r2";

/**
 * Proof document for a single accessorial line item.
 *
 * The load may not exist yet (the form uploads while it is still being filled
 * in), so this can't create a Document row — it returns the R2 object key,
 * which is stored inside the load's `accessorials` JSON.
 *
 * R2 rather than Vercel Blob: lib/storage.ts falls back to writing into
 * public/uploads when BLOB_READ_WRITE_TOKEN is missing, and that filesystem is
 * read-only in production, so the upload failed and the receipt was silently
 * lost. Every other document on a load already goes to R2.
 *
 * GET ?key=... hands back a short-lived signed URL for viewing.
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

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let me: Awaited<ReturnType<typeof requirePermission>>;
  try {
    me = await requirePermission("loads:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const loadId = (formData.get("loadId") as string | null) || null;

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || "unknown"}. Allowed: PDF, JPEG, PNG, WEBP, GIF, HEIC.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, sizeBytes } = await uploadPrivate(buffer, file.name, "accessorials");

    // When the load already exists (editing), file it under Documents too —
    // otherwise the proof is only reachable from inside the accessorial row.
    if (loadId) {
      const load = await prisma.load.findUnique({
        where: { id: loadId },
        select: { companyId: true },
      });
      if (load && (!me.companyId || load.companyId === me.companyId)) {
        await prisma.document.create({
          data: {
            companyId: load.companyId,
            type: "ACCESSORIAL",
            name: file.name,
            url: key,
            mimeType: file.type,
            sizeBytes,
            loadId,
            uploadedById: me.id,
          },
        });
        revalidatePath(`/dispatch/loads/${loadId}`);
      }
    }

    return NextResponse.json({ ok: true, url: key, name: file.name });
  } catch (err) {
    console.error("[accessorial-doc] upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("loads:read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  // Only ever hand out keys this route wrote.
  if (!key.startsWith("accessorials/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  try {
    return NextResponse.json({ url: await getSignedDownloadUrl(key, 3600) });
  } catch (err) {
    console.error("[accessorial-doc] signing failed:", err);
    return NextResponse.json({ error: "Could not open document" }, { status: 500 });
  }
}
