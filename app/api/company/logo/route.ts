import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { saveFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(req: NextRequest) {
  let me: Awaited<ReturnType<typeof requirePermission>>;
  try {
    me = await requirePermission("company:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = me.companyId;
  if (!companyId && me.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No company associated" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const targetCompanyId = (formData.get("companyId") as string | null) ?? companyId;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Only images allowed (JPEG, PNG, WEBP, GIF, SVG)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }
  if (!targetCompanyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await saveFile(buffer, file.name, "logos");

  await prisma.company.update({
    where: { id: targetCompanyId },
    data: { logoUrl: url },
  });

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, url });
}
