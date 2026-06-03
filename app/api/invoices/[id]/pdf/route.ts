import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

async function fetchLogoBase64(
  logoUrl: string | null | undefined,
): Promise<{ logoBase64: string; logoFormat: "PNG" | "JPEG" | "WEBP" } | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const format: "PNG" | "JPEG" | "WEBP" =
      contentType.includes("png") ? "PNG" :
      contentType.includes("webp") ? "WEBP" : "JPEG";
    const buf = Buffer.from(await res.arrayBuffer());
    return { logoBase64: buf.toString("base64"), logoFormat: format };
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("invoices:read");
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
    include: { company: true, customer: true, load: { select: { referenceNumber: true, pickupCity: true, deliveryCity: true } } },
  });
  if (!inv) return new NextResponse("Not found", { status: 404 });

  const logo = await fetchLogoBase64(inv.company.logoUrl);

  const pdf = renderInvoicePdf({
    ...inv,
    customer: inv.customer ?? {
      name: (inv as { customerName?: string | null }).customerName ?? "Unknown",
      taxId: null,
      registrationNumber: null,
      street: null,
      city: null,
      county: null,
      postalCode: null,
      country: null,
    },
    logoBase64: logo?.logoBase64 ?? null,
    logoFormat: logo?.logoFormat ?? null,
  });
  const body = new Uint8Array(pdf);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
