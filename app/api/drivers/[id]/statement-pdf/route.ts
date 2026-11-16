import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { loadDriverPdfInput, renderDriverStatementPdf } from "@/lib/driver-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await requirePermission("drivers:read");
  const { id } = await ctx.params;
  const period = new URL(req.url).searchParams.get("period") ?? "week";

  const input = await loadDriverPdfInput(me.companyId, id, period);
  if (!input) return new NextResponse("Not found", { status: 404 });

  const name = input.fullName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const when = input.data.periodLabel.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(renderDriverStatementPdf(input)), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${name}-${when}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
