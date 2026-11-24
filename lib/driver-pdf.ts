import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { prisma } from "@/lib/prisma";
import { getDriverFinancialData } from "@/lib/driver-report";
import { getCompanyCurrency } from "@/lib/company-context";
import { fetchLogoBase64, type PdfLogo } from "@/lib/company-logo";
import { visibleEmail } from "@/lib/placeholder-email";
import { sanitize, truncate } from "@/lib/invoice-pdf";
import { loadTotal } from "@/lib/accessorials";
import { getPeriodRange } from "@/lib/period";
import { splitExternal } from "@/lib/external-driver";

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
  phone: string;
  /** Who the full report is addressed to: the driver, or the truck owner when asked for. */
  reportName: string;
  reportEmail: string;
  /** Truck owner, for an external driver: owner's name, else the driver's company. */
  ownerLabel: string | null;
  /** Invoiced and paid loads from January 1 to the end of the period (year to date). */
  ytdLoads: {
    price: number;
    accessorialAmount: number | null;
    permitAmount: number | null;
    actualDistanceKm: number | null;
    estimatedDistanceKm: number | null;
  }[];
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
  /** Whose name and email head the full report. */
  party: "driver" | "owner" = "driver",
): Promise<DriverPdfInput | null> {
  const driver = await prisma.driverProfile.findFirst({
    where: { id: driverId, companyId: companyId ?? undefined },
    include: { user: { select: { email: true, phone: true } } },
  });
  if (!driver) return null;
  // A super admin has no company of their own: use the driver's.
  const ownCompanyId = companyId ?? driver.companyId;

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
    await getCompanyCurrency(ownCompanyId),
    driver.isExternal
      ? {
          company: driver.externalCompany ?? "Their company",
          ourPercent: driver.ourCutPercent ?? 0,
        }
      : null,
  );

  // Year to date: January 1 up to the end of the period, counting only loads
  // that were at least invoiced — what has really been earned so far.
  const { to } = getPeriodRange(period);
  const ytdLoads = await prisma.load.findMany({
    where: {
      driverId: driver.id,
      pickupDate: { gte: new Date(to.getFullYear(), 0, 1), lte: to },
      status: { in: ["INVOICED", "PAID"] },
    },
    select: {
      price: true,
      accessorialAmount: true,
      permitAmount: true,
      actualDistanceKm: true,
      estimatedDistanceKm: true,
    },
  });

  const company = ownCompanyId
    ? await prisma.company.findUnique({
        where: { id: ownCompanyId },
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

  const fullName = `${driver.firstName} ${driver.lastName}`;
  const email = visibleEmail(driver.user.email);
  const ownerLabel = driver.isExternal
    ? driver.ownerName?.trim() || driver.externalCompany?.trim() || null
    : null;
  const asOwner = party === "owner" && ownerLabel != null;

  return {
    fullName,
    email,
    reportName: asOwner ? ownerLabel : fullName,
    reportEmail: asOwner ? (driver.ownerEmail ?? "") : email,
    ownerLabel,
    phone: driver.user.phone ?? "",
    ytdLoads,
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
function letterhead(
  doc: jsPDF,
  input: DriverPdfInput,
  opts: { maxTextW?: number; rule?: boolean } = {},
): number {
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

  const maxW = opts.maxTextW ?? W - MR - textX;
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
  if (opts.rule === false) return end + 4;
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
  doc.text(truncate(doc, input.reportName, W * 0.5), ML, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRAY);
  if (input.reportEmail) doc.text(truncate(doc, input.reportEmail, W * 0.5), ML, y + 10);

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

type PlaceLoad = {
  pickupCity: string | null;
  pickupState: string | null;
  pickupAddress: string;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryAddress: string;
  pickupDate: Date;
  deliveryDate: Date;
};

const place = (city: string | null, state: string | null, address: string) =>
  city
    ? [city, state].filter(Boolean).join(", ")
    : address.split(",").slice(0, 2).join(",").trim();

/** "Monroe, NC -> Dallas, TX": where the load went from and to. */
const loadRoute = (l: PlaceLoad) =>
  `${place(l.pickupCity, l.pickupState, l.pickupAddress)} -> ${place(l.deliveryCity, l.deliveryState, l.deliveryAddress)}`;

/** "11/01/2026 -> 11/03/2026": pickup and delivery dates. */
const loadDates = (l: PlaceLoad, fmtDate: (d: Date | string | null) => string) =>
  `${fmtDate(l.pickupDate)} -> ${fmtDate(l.deliveryDate)}`;

/** What a load adds to the total: for an external driver rate + accessorials. */
const loadAmount = (
  data: ReportData,
  l: { price: number; accessorialAmount: number | null },
) => (data.external ? loadTotal(l) : l.price);

const miles = (km: number) => `${Math.round(km).toLocaleString("en-US")} Mi`;

// ── 1. the full report ──────────────────────────────────────────────────────

export function renderDriverReportPdf(input: DriverPdfInput): Uint8Array {
  const { data } = input;
  const fullName = input.reportName;
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
    ["Driver net salary", fmt(data.taxes.net, currency)],
  ]);

  // Loads
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...DARK);
  doc.text(`Loads (${loads.length})`, ML, y);
  const body = loads.map((l) => [
    sanitize(l.referenceNumber),
    sanitize(`${loadRoute(l)}\n${loadDates(l, fmtDate)}`),
    sanitize(l.customer?.name ?? "-"),
    sanitize(l.truck?.plateNumber ?? "-"),
    Math.round(l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0).toLocaleString("en-US"),
    fmt(loadAmount(data, l), l.currency),
  ]);
  autoTable(doc, {
    startY: y + 2,
    head: [["Load #", "Description (from -> to, dates)", "Customer", "Truck", "Mi", "Price"]],
    body: body.length ? body : [["No loads in this period", "", "", "", "", ""]],
    foot: body.length
      ? [["TOTAL", "", "", "", Math.round(data.totalKm).toLocaleString("en-US"), fmt(data.revenue, currency)]]
      : undefined,
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    theme: "plain",
    margin: { left: ML, right: MR },
    styles: { fontSize: 8, cellPadding: 2, textColor: DARK, lineColor: LGRAY, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", lineWidth: 0 },
    footStyles: { fillColor: SOFT, textColor: DARK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: "auto" },
      3: { cellWidth: 22 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 26 },
    },
    didParseCell: (h) => {
      if ((h.section === "head" || h.section === "foot") && (h.column.index === 4 || h.column.index === 5)) {
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
    y += note.length * 3.2 + 6;
  }

  // Year to date: what the driver and the truck owner earned so far.
  const ext = data.external;
  const driverYtd =
    data.salaryType === "FIXED"
      ? null
      : round2(
          input.ytdLoads.reduce(
            (t, l) => t + (loadPay(input, loadAmount(data, l), loadMiles(l)) ?? 0),
            0,
          ),
        );
  const ownerYtd = ext
    ? round2(
        input.ytdLoads.reduce(
          (t, l) =>
            t +
            splitExternal(loadTotal(l), ext.ourPercent, data.grossPercent ?? 0, l.permitAmount ?? 0)
              .partner,
          0,
        ),
      )
    : null;
  const periodDriver = round2(data.baseSalary + data.commission);
  const earned: Row[] = [];
  if (data.salaryType !== "FIXED" || periodDriver > 0) {
    earned.push({ label: "Driver earned this period", value: fmt(periodDriver, currency), bold: true });
  }
  if (data.externalSplit) {
    earned.push({
      label: `Truck owner earned this period${input.ownerLabel ? ` (${input.ownerLabel})` : ""}`,
      value: fmt(data.externalSplit.partner, currency),
      bold: true,
    });
  }
  if (earned.length) y = keyValueTable(doc, y, "Earned in this period", earned);

  const ytd: Row[] = [
    { label: "Loads (invoiced / paid)", value: String(input.ytdLoads.length) },
    {
      label: "Total of these loads",
      value: fmt(input.ytdLoads.reduce((t, l) => t + loadAmount(data, l), 0), currency),
    },
  ];
  if (driverYtd != null) {
    ytd.push({ label: "Driver earned so far", value: fmt(driverYtd, currency), bold: true, rule: true });
  }
  if (ownerYtd != null) {
    ytd.push({
      label: `Truck owner earned so far${input.ownerLabel ? ` (${input.ownerLabel})` : ""}`,
      value: fmt(ownerYtd, currency),
      bold: true,
    });
  }
  y = keyValueTable(doc, y, "Year to Date (invoiced and paid loads)", ytd);

  footers(doc, sanitize(`Report auto-generated by TMS - ${fullName} - ${data.periodLabel}`));
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

// ── 2. the driver's settlement ──────────────────────────────────────────────

/**
 * Handed to the driver, in the shape of a classic driver settlement: the
 * company letterhead, one line per load (from, to, dates, gross, how he is
 * paid, what he gets), the year to date, and a short summary.
 * No expenses, taxes or what the company keeps.
 */

const shortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });

const round2 = (n: number) => Math.round(n * 100) / 100;

const loadMiles = (l: { actualDistanceKm: number | null; estimatedDistanceKm: number | null }) =>
  l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0;

/** What one load pays the driver; null when his pay isn't per load (fixed). */
function loadPay(input: DriverPdfInput, amount: number, miles: number): number | null {
  const d = input.data;
  if (d.salaryType === "PERCENT_GROSS") return round2((amount * (d.grossPercent ?? 0)) / 100);
  if (d.salaryType === "FIXED") return null;
  return round2(miles * (input.salaryPerKm ?? 0) + (amount * (input.commissionRate ?? 0)) / 100);
}

/** How he is paid, short enough for a narrow column. */
function methodLabel(input: DriverPdfInput): string {
  const d = input.data;
  if (d.salaryType === "PERCENT_GROSS") return `${d.grossPercent ?? 0}%`;
  if (d.salaryType === "FIXED") return "Fixed";
  return input.salaryPerKm ? `$${input.salaryPerKm}/mi` : "-";
}

export function renderDriverStatementPdf(input: DriverPdfInput): Uint8Array {
  const { data } = input;
  const { fmt, currency } = data;
  const doc = newDoc();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Header: our logo and details on the left, the document on the right.
  const top = 14;
  let y = letterhead(doc, input, { maxTextW: 100, rule: false });
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...DARK);
  doc.text("Driver Settlement", W - MR, top + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRAY);
  doc.text(sanitize(`Period: ${data.periodLabel}`), W - MR, top + 10, { align: "right" });
  doc.text(`Settlement Date: ${shortDate(new Date())}`, W - MR, top + 15, { align: "right" });

  // Who it is for.
  y += 4;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DARK);
  doc.text(sanitize(input.fullName.toUpperCase()), ML, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRAY);
  for (const line of [input.phone, input.email].filter(Boolean)) {
    y += 4.5;
    doc.text(sanitize(line), ML, y);
  }
  y += 8;

  // One line per load.
  let paySum = 0;
  let grossSum = 0;
  let milesSum = 0;
  const methodText = methodLabel(input);
  const body = data.loads.map((l) => {
    const amount = loadAmount(data, l);
    const miles = loadMiles(l);
    const pay = loadPay(input, amount, miles);
    grossSum += amount;
    milesSum += miles;
    if (pay != null) paySum += pay;
    return [
      sanitize(l.referenceNumber),
      sanitize(place(l.pickupCity, l.pickupState, l.pickupAddress).toUpperCase()),
      sanitize(place(l.deliveryCity, l.deliveryState, l.deliveryAddress).toUpperCase()),
      Math.round(miles).toLocaleString("en-US"),
      sanitize(l.truck?.plateNumber ?? "-"),
      shortDate(l.pickupDate),
      shortDate(l.deliveryDate),
      fmt(amount, l.currency),
      sanitize(methodText),
      pay != null ? fmt(pay, l.currency) : "-",
    ];
  });
  // A fixed salary isn't earned load by load: the whole amount is the total.
  const grandTotal = data.salaryType === "FIXED" ? data.baseSalary : paySum;

  autoTable(doc, {
    startY: y,
    head: [["Load #", "Origin", "Destn", "Dist", "Tractor", "Ship Date", "Delv Date", "Gross", "Method", "Net Pay"]],
    body: body.length ? body : [["No loads in this period", "", "", "", "", "", "", "", "", ""]],
    foot: body.length
      ? [["Total", "", "", Math.round(milesSum).toLocaleString("en-US"), "", "", "", fmt(grossSum, currency), "", fmt(grandTotal, currency)]]
      : undefined,
    showFoot: "lastPage",
    theme: "plain",
    margin: { left: ML, right: MR },
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: DARK, lineColor: LGRAY, lineWidth: { bottom: 0.15 }, valign: "middle" },
    headStyles: { fillColor: [229, 231, 235], textColor: DARK, fontStyle: "bold", lineWidth: 0 },
    footStyles: { fillColor: SOFT, textColor: DARK, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 23 },
      2: { cellWidth: 23 },
      3: { halign: "right", cellWidth: 15 },
      4: { cellWidth: 14 },
      5: { cellWidth: 16 },
      6: { cellWidth: 16 },
      7: { halign: "right", cellWidth: 21 },
      8: { cellWidth: 17 },
      9: { halign: "right", cellWidth: 20 },
    },
    didParseCell: (h) => {
      if ((h.section === "head" || h.section === "foot") && [3, 7, 9].includes(h.column.index)) {
        h.cell.styles.halign = "right";
      }
    },
  });
  y = lastY(doc, y + 20) + 12;

  if (y > H - 75) {
    doc.addPage();
    y = 20;
  }

  // Year to date, as of the end of this period.
  const ytdGross = input.ytdLoads.reduce((t, l) => t + loadAmount(data, l), 0);
  const ytdNet =
    data.salaryType === "FIXED"
      ? null
      : input.ytdLoads.reduce(
          (t, l) => t + (loadPay(input, loadAmount(data, l), loadMiles(l)) ?? 0),
          0,
        );
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...DARK);
  doc.text("Year to Date Gross:", ML, y);
  doc.text(fmt(ytdGross, currency), ML + 48, y);
  if (ytdNet != null) {
    y += 6;
    doc.text("Year to Date Net:", ML, y);
    doc.text(fmt(ytdNet, currency), ML + 48, y);
  }

  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...DARK);
  doc.text(`Grand Total: ${fmt(grandTotal, currency)}`, ML, y);

  // Settlement summary.
  y += 12;
  doc.setFontSize(10);
  doc.text("Settlement Summary:", ML, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const summary = [
    `Loads Total: ${data.loads.length}`,
    `Gross Pay Total: ${fmt(grossSum, currency)}`,
    `Miles Total: ${Math.round(milesSum).toLocaleString("en-US")}`,
    ...(data.salaryType === "PERCENT_GROSS" ? [`Pay Percentage: ${data.grossPercent ?? 0}%`] : []),
  ];
  for (const line of summary) {
    y += 5.5;
    doc.text(sanitize(line), ML, y);
  }

  footers(doc, sanitize(`${input.fullName} - ${data.periodLabel}`));
  return doc.output("arraybuffer") as unknown as Uint8Array;
}
