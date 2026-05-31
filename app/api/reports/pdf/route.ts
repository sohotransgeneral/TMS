import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { renderReportPdf } from "@/lib/report-pdf";

export async function GET() {
  const me = await requirePermission("reports:read");
  const companyId = me.companyId ?? undefined;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    : null;

  const [invoices, payments, loads, expenses, fuel, fleet, drivers] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId, issueDate: { gte: yearStart } },
      select: { number: true, issueDate: true, total: true, paidAmount: true, status: true, customer: { select: { name: true } } },
      orderBy: { issueDate: "desc" },
      take: 200,
    }),
    prisma.payment.aggregate({ where: { companyId, paidAt: { gte: yearStart } }, _sum: { amount: true }, _count: true }),
    prisma.load.findMany({
      where: { companyId, updatedAt: { gte: last30 } },
      select: { referenceNumber: true, status: true, price: true, currency: true, customer: { select: { name: true } }, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.expense.findMany({
      where: { companyId, occurredAt: { gte: yearStart }, status: "APPROVED" },
      select: { description: true, amount: true, type: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
    prisma.fuelEntry.aggregate({ where: { companyId }, _sum: { liters: true, totalAmount: true }, _count: true }),
    prisma.truck.aggregate({ where: { companyId }, _count: true }),
    prisma.driverProfile.aggregate({ where: { companyId }, _count: true }),
  ]);

  const pdf = renderReportPdf({
    companyName: company?.name ?? "TMS",
    generatedAt: now,
    invoices: invoices.map((i) => ({
      number: i.number,
      date: i.issueDate,
      customer: i.customer?.name ?? "—",
      total: i.total,
      paid: i.paidAmount,
      status: i.status,
    })),
    paymentsSummary: { count: payments._count, total: payments._sum.amount ?? 0 },
    loads: loads.map((l) => ({
      ref: l.referenceNumber,
      customer: l.customer?.name ?? "—",
      status: l.status,
      price: l.price,
      currency: l.currency,
      date: l.updatedAt,
    })),
    expenses: expenses.map((e) => ({
      description: e.description ?? "—",
      type: e.type,
      amount: e.amount,
      date: e.occurredAt,
    })),
    fuelSummary: { count: fuel._count, liters: fuel._sum.liters ?? 0, amount: fuel._sum.totalAmount ?? 0 },
    fleetCount: fleet._count,
    driverCount: drivers._count,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Raport-TMS-${now.toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
