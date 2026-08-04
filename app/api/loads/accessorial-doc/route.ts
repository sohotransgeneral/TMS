import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { saveFile } from "@/lib/storage";

/**
 * Uploads the proof document for a single accessorial line item.
 *
 * The load may not exist yet (the "New load" form uploads while the user is
 * still filling the form), so this returns a plain URL that gets stored inside
 * the load's `accessorials` JSON — same pattern as truck permits.
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

export async function POST(req: NextRequest) {
  try {
    await requirePermission("loads:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, WEBP, GIF, HEIC.` },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await saveFile(buffer, file.name, "accessorials");

  return NextResponse.json({ ok: true, url, name: file.name });
}
