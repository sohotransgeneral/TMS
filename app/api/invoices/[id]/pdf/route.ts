import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("invoices:read");
  const { id } = await ctx.params;

  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
    include: { company: true, customer: true, load: { select: { referenceNumber: true, pickupCity: true, deliveryCity: true } } },
  });
  if (!inv) return new NextResponse("Not found", { status: 404 });

  const pdf = renderInvoicePdf(inv);
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
