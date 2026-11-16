import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { getDriverFinancialData } from "@/lib/driver-report";
import { getCompanyCurrency } from "@/lib/company-context";
import { fetchLogoBase64, type PdfLogo } from "@/lib/company-logo";
import { visibleEmail } from "@/lib/placeholder-email";
import { sanitize, truncate } from "@/lib/invoice-pdf";

/**
 * Two PDFs for a driver and a period:
 *  - the full financial report (everything: loads, expenses, salary, taxes)
 *  - the driver statement: the total that accumulated and his percentage.
 */

type RGB = [number, number, number];
const DARK: RGB = [15, 23, 42];
const GRAY: RGB = [107, 114, 128];
const LGRAY: RGB = [209, 213, 219];
const BRAND: RGB = [30, 64, 175];
const RED: RGB = [220, 38, 38];
const SOFT: RGB = [248, 250, 252];

const ML = 15;
const MR = 15;

type ReportData = Awaited<ReturnType<typeof getDriverFinancialData>>;

type CompanyInfo = {
  name: string;
  legalName: string | null;
  street: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mcNumber: string | null;
  dotNumber: string | null;
  taxId: string | null;
};

export type DriverPdfInput = {
  fullName: string;
  email: string;
  data: ReportData;
  company: CompanyInfo | null;
  logo: PdfLogo | null;
  salaryPerKm: number | null;
  commissionRate: number | null;
};

/** Everything both PDFs need, or null when the driver isn't in this company. */
export async function loadDriverPdfInput(
  companyId: string | null,
  driverId: string,
  period: string,
): Promise<DriverPdfInput | null> {
  const driver = await prisma.driverProfile.findFirst({
    where: { id: driverId, companyId: companyId ?? undefined },
    include: { user: { select: { email: true } } },
  });
  if (!driver) return null;

  const data = await getDriverFinancialData(
    driver.id,
    driver.salaryType,
    driver.salaryPerKm,
    driver.grossPercent,
    driver.salaryFixedAmount,
    driver.commissionRate,
    // An external driver isn't our employee, so no payroll taxes.
    driver.isExternal ? 0 : ((driver as { taxCas?: number | null }).taxCas ?? null),
    driver.isExternal ? 0 : ((driver as { taxCass?: number | null }).taxCass ?? null),
    driver.isExternal ? 0 : ((driver as { taxImpozit?: number | null }).taxImpozit ?? null),
    period,
    await getCompanyCurrency(companyId),
    driver.isExternal
      ? {
          company: driver.externalCompany ?? "Their company",
          ourPercent: driver.ourCutPercent ?? 0,
        }
      : null,
  );

  const company = companyId
    ? await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          legalName: true,
          logoUrl: true,
          street: true,
          city: true,
          county: true,
          postalCode: true,
          country: true,
          phone: true,
          email: true,
          website: true,
          mcNumber: true,
          dotNumber: true,
          taxId: true,
        },
      })
    : null;

  return {
    fullName: `${driver.firstName} ${driver.lastName}`,
    email: visibleEmail(driver.user.email),
    data,
    company,
    logo: company ? await fetchLogoBase64(company.logoUrl) : null,
    salaryPerKm: driver.salaryPerKm,
    commissionRate: driver.commissionRate,
  };
}

// ── shared pieces ───────────────────────────────────────────────────────────

const newDoc = () => new jsPDF({ unit: "mm", format: "a4" });

function lastY(doc: jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? fallback
  );
}

function companyLines(c: CompanyInfo): string[] {
  const cityLine = [c.city, [c.county, c.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [
    [c.street, cityLine, c.country].filter(Boolean).join(", "),
    [c.phone, c.email, c.website].filter(Boolean).join("  .  "),
    [
      c.mcNumber ? `MC ${c.mcNumber}` : null,
      c.dotNumber ? `DOT ${c.dotNumber}` : null,
      c.taxId ? `Tax ID ${c.taxId}` : null,
    ]
      .filter(Boolean)
      .join("  .  "),
  ].filter(Boolean);
}

/** Logo on the left, company name and details beside it. Returns the next y. */
function letterhead(doc: jsPDF, input: DriverPdfInput): number {
  const W = doc.internal.pageSize.getWidth();
  const top = 14;
  const c = input.company;
  if (!c) return top;

  let textX = ML;
  let blockH = 0;
  if (input.logo) {
    try {
      doc.addImage(input.logo.logoBase64, input.logo.logoFormat, ML, top - 4, 20, 20);
      textX = ML + 25;
      blockH = 20;
    } catch {
      // unsupported image: the name alone is fine
    }
  }

  const maxW = W - MR - textX;
  let y = top + 1;
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...DARK);
  doc.text(truncate(doc, (c.legalName || c.name).toUpperCase(), maxW), textX, y + 3);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
  for (const line of companyLines(c)) {
    doc.text(truncate(doc, line, maxW), textX, y);
    y += 4;
  }
  const end = Math.max(y, top - 4 + blockH) + 1;
  doc.setDrawColor(...BRAND).setLineWidth(0.6).line(ML, end, W - MR, end);
  return end + 7;
}

function titleBlock(
  doc: jsPDF,
  input: DriverPdfInput,
  title: string,
  y: number,
): number {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...DARK);
  doc.text(truncate(doc, input.fullName, W * 0.5), ML, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRAY);
  if (input.email) doc.text(truncate(doc, input.email, W * 0.5), ML, y + 10);

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...DARK);
  doc.text(title, W - MR, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRAY);
  doc.text(sanitize(input.data.periodLabel), W - MR, y + 10, { align: "right" });
  const generated = new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(8);
  doc.text(`Generated ${generated}`, W - MR, y + 15, { align: "right" });
  return y + 20;
}

function footers(doc: jsPDF, left: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LGRAY).setLineWidth(0.2).line(ML, H - 12, W - MR, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GRAY);
    doc.text(truncate(doc, left, W - 60), ML, H - 7);
    doc.text(`Page ${p} / ${pages}`, W - MR, H - 7, { align: "right" });
  }
}

/** A row of small labelled figures. */
function figures(doc: jsPDF, y: number, items: [string, string][]): number {
  autoTable(doc, {
    startY: y,
    head: [items.map(([label]) => sanitize(label))],
    body: [items.map(([, value]) => sanitize(value))],
    theme: "plain",
    margin: { left: ML, right: MR },
    styles: { fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: DARK },
    headStyles: { fontSize: 7, textColor: GRAY, fontStyle: "normal", fillColor: SOFT },
    bodyStyles: { fontStyle: "bold", fillColor: SOFT },
  });
  return lastY(doc, y + 14) + 6;
}

type Row = { label: string; value: string; neg?: boolean; bold?: boolean; rule?: boolean };

function keyValueTable(doc: jsPDF, y: number, title: string, rows: Row[]): number {
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 50) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...DARK);
  doc.text(title, ML, y);
  autoTable(doc, {
    startY: y + 2,
    body: rows.map((r) => [sanitize(r.label), sanitize(r.value)]),
    theme: "plain",
    margin: { left: ML, right: MR },
    styles: { fontSize: 9, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, textColor: DARK },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 55 } },
    didParseCell: (h) => {
      const r = rows[h.row.index];
      if (!r) return;
      if (r.bold) h.cell.styles.fontStyle = "bold";
      if (r.neg && h.column.index === 1) h.cell.styles.textColor = RED;
      if (r.rule) {
        h.cell.styles.lineWidth = { top: 0.3, right: 0, bottom: 0, left: 0 };
        h.cell.styles.lineColor = LGRAY;
      }
    },
  });
  return lastY(doc, y + 20) + 8;
}

const miles = (km: number) => `${Math.round(km).toLocaleString("en-US")} Mi`;

// ── 1. the full report ──────────────────────────────────────────────────────

export function renderDriverReportPdf(input: DriverPdfInput): Uint8Array {
  const { data, fullName } = input;
  const { fmt, fmtDate, loads, currency } = data;
  const doc = newDoc();
  const W = doc.internal.pageSize.getWidth();

  let y = letterhead(doc, input);
  y = titleBlock(doc, input, "Financial Report", y);

  // External driver: how the load total was divided.
  if (data.external && data.externalSplit) {
    const s = data.externalSplit;
    const items: [string, string][] = [
      ["Load total", fmt(s.total, currency)],
      [`We keep (${data.external.ourPercent}%)`, fmt(s.our, currency)],
      [`Driver (${data.grossPercent ?? 0}%)`, fmt(s.driver, currency)],
      [`${data.external.company} share (${s.partnerPercent}%)`, fmt(s.partnerShare, currency)],
    ];
    if (s.permits > 0) {
      items.push(["Permits (from their share)", `- ${fmt(s.permits, currency)}`]);
      items.push([`Owed to ${data.external.company}`, fmt(s.partner, currency)]);
    }
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...GRAY);
    doc.text(sanitize(`EXTERNAL DRIVER  .  ${data.external.company}`.toUpperCase()), ML, y);
    y = figures(doc, y + 2, items);
  }

  y = figures(doc, y, [
    ["Loads", String(loads.length)],
    ["Gross revenue", fmt(data.revenue, currency)],
    ["Distance", miles(data.totalKm)],
    ["Net salary", fmt(data.taxes.net, currency)],
  ]);

  // Loads
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...DARK);
  doc.text(`Loads (${loads.length})`, ML, y);
  const body = loads.map((l) => [
    sanitize(l.referenceNumber),
    sanitize(`${l.pickupCity ?? l.pickupAddress.slice(0, 25)}\n${fmtDate(l.pickupDate)}`),
    sanitize(`${l.deliveryCity ?? l.deliveryAddress.slice(0, 25)}\n${fmtDate(l.deliveryDate)}`),
    sanitize(l.customer?.name ?? "-"),
    sanitize(l.truck?.plateNumber ?? "-"),
    Math.round(l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0).toLocaleString("en-US"),
    fmt(l.price, l.currency),
  ]);
  autoTable(doc, {
    startY: y + 2,
    head: [["Ref. No.", "Pickup", "Delivery", "Customer", "Truck", "Mi", "Price"]],
    body: body.length ? body : [["No loads in this period", "", "", "", "", "", ""]],
    foot: body.length
      ? [["TOTAL", "", "", "", "", Math.round(data.totalKm).toLocaleString("en-US"), fmt(data.revenue, currency)]]
      : undefined,
    showFoot: "lastPage",
    theme: "plain",
    margin: { left: ML, right: MR },
    styles: { fontSize: 8, cellPadding: 2, textColor: DARK, lineColor: LGRAY, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", lineWidth: 0 },
    footStyles: { fillColor: SOFT, textColor: DARK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 20 },
      5: { halign: "right", cellWidth: 16 },
      6: { halign: "right", cellWidth: 26 },
    },
    didParseCell: (h) => {
      if ((h.section === "head" || h.section === "foot") && (h.column.index === 5 || h.column.index === 6)) {
        h.cell.styles.halign = "right";
      }
    },
  });
  y = lastY(doc, y + 20) + 8;

  // Expenses & deductions
  const exp: Row[] = [{ label: "Total revenue", value: fmt(data.revenue, currency) }];
  const add = (label: string, amount: number) => {
    if (amount > 0) exp.push({ label, value: `- ${fmt(amount, currency)}`, neg: true });
  };
  add(`Fuel (${data.fuelCount} entries)`, data.fuelCost);
  add("Tolls / Bridge", data.tollCost);
  add("Parking", data.parkingCost);
  add("Repairs", data.repairCost);
  add("Maintenance", data.maintCost);
  add("Special permits", data.permitsCost);
  add("Other expenses", data.otherCost);
  if (data.totalDeductions === 0) exp.push({ label: "No expenses", value: "-" });
  exp.push({
    label: "Total deductions",
    value: `- ${fmt(data.totalDeductions, currency)}`,
    neg: true,
    bold: true,
    rule: true,
  });
  exp.push({ label: "Net contribution", value: fmt(data.netContribution, currency), bold: true });
  y = keyValueTable(doc, y, "Expenses & Deductions", exp);

  // Salary & taxes
  const sal: Row[] = [
    { label: "Distance driven", value: miles(data.totalKm) },
    {
      label: `Rate ${currency}/Mi`,
      value: input.salaryPerKm ? `${input.salaryPerKm} ${currency}/Mi` : "-",
    },
    { label: "Base salary", value: fmt(data.baseSalary, currency) },
  ];
  if (input.commissionRate && input.commissionRate > 0) {
    sal.push({ label: `Commission (${input.commissionRate}%)`, value: fmt(data.commission, currency) });
  }
  for (const a of data.adjustments.filter((x) => x.amount > 0)) {
    sal.push({ label: `+ ${a.label}`, value: fmt(a.amount, currency) });
  }
  for (const a of data.adjustments.filter((x) => x.amount < 0)) {
    sal.push({ label: `- ${a.label}`, value: `- ${fmt(Math.abs(a.amount), currency)}`, neg: true });
  }
  sal.push({ label: "GROSS salary", value: fmt(data.brutSalary, currency), bold: true, rule: true });
  const r = data.taxRates;
  if (r.cas > 0 || r.cass > 0 || r.impozit > 0) {
    sal.push({ label: `Employee pension (${r.cas}%)`, value: `- ${fmt(data.taxes.cas, currency)}`, neg: true });
    sal.push({ label: `Employee health ins. (${r.cass}%)`, value: `- ${fmt(data.taxes.cass, currency)}`, neg: true });
    sal.push({ label: `Income tax (${r.impozit}%)`, value: `- ${fmt(data.taxes.impozit, currency)}`, neg: true });
    sal.push({ label: "Total taxes", value: `- ${fmt(data.taxes.total, currency)}`, neg: true, bold: true, rule: true });
  }
  sal.push({ label: "NET SALARY PAYABLE", value: fmt(data.taxes.net, currency), bold: true, rule: true });
  y = keyValueTable(doc, y, "Salary & Tax Breakdown", sal);

  if (r.cas > 0 || r.cass > 0 || r.impozit > 0) {
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRAY);
    const note = doc.splitTextToSize(
      "Taxes calculated per Romanian law: Pension 25% + Health Ins. 10% + Income Tax 10% of (Gross - Pension - Health Ins.).",
      W - ML - MR,
    );
    doc.text(note, ML, y);
  }

  footers(doc, sanitize(`Report auto-generated by TMS - ${fullName} - ${data.periodLabel}`));
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ── 2. the driver's own statement ───────────────────────────────────────────

/**
 * For the driver: the total that built up in the period and his percentage —
 * nothing else (no expenses, taxes, or what the company keeps).
 */
export function renderDriverStatementPdf(input: DriverPdfInput): Uint8Array {
  const { data } = input;
  const { fmt, currency } = data;
  const doc = newDoc();
  const W = doc.internal.pageSize.getWidth();

  let y = letterhead(doc, input);
  y = titleBlock(doc, input, "Driver Statement", y) + 6;

  // His percentage; a driver paid per mile or a fixed amount has a rate instead.
  const percent =
    data.salaryType === "PERCENT_GROSS" && data.grossPercent != null
      ? `${data.grossPercent}%`
      : data.salaryType === "FIXED"
        ? "Fixed amount"
        : input.salaryPerKm
          ? `${input.salaryPerKm} ${currency} / Mi`
          : "-";

  const boxes: [string, string][] = [
    ["Total accumulated", fmt(data.revenue, currency)],
    [data.salaryType === "PERCENT_GROSS" ? "Your percentage" : "Your pay rate", percent],
  ];
  const gap = 8;
  const boxW = (W - ML - MR - gap) / 2;
  boxes.forEach(([label, value], i) => {
    const x = ML + i * (boxW + gap);
    doc.setFillColor(...SOFT).setDrawColor(...LGRAY).setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, 38, 2, 2, "FD");
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRAY);
    doc.text(label, x + boxW / 2, y + 12, { align: "center" });
    doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(...DARK);
    doc.text(truncate(doc, value, boxW - 8), x + boxW / 2, y + 28, { align: "center" });
  });

  // What he earned: his percentage (or rate) applied to the total.
  const pay = data.baseSalary + data.commission;
  const payY = y + 38 + gap;
  doc.setFillColor(...BRAND).setDrawColor(...BRAND).setLineWidth(0.3);
  doc.roundedRect(ML, payY, W - ML - MR, 38, 2, 2, "FD");
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(199, 210, 254);
  doc.text("Your amount", W / 2, payY + 12, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(28).setTextColor(255, 255, 255);
  doc.text(fmt(pay, currency), W / 2, payY + 29, { align: "center" });

  footers(doc, sanitize(`${input.fullName} - ${data.periodLabel}`));
  return doc.output("arraybuffer") as unknown as Uint8Array;
}
