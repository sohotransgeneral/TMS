import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type InvoiceForPdf = {
  number: string;
  series: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  notes: string | null;
  items: unknown;
  status: string;
  /** Base64-encoded PNG/JPEG logo (optional) */
  logoBase64?: string | null;
  logoFormat?: "PNG" | "JPEG" | "WEBP" | null;
  company: {
    name: string;
    taxId: string | null;
    registrationNumber: string | null;
    street: string | null;
    city: string | null;
    county: string | null;
    postalCode: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    bankName: string | null;
    bankAccount: string | null;
  };
  customer: {
    name: string;
    taxId: string | null;
    registrationNumber: string | null;
    street: string | null;
    city: string | null;
    county: string | null;
    postalCode: string | null;
    country: string | null;
  };
  load?: {
    referenceNumber: string;
    pickupCity: string | null;
    deliveryCity: string | null;
  } | null;
};

type Item = { description: string; quantity: number; unitPrice: number };
type RGB = [number, number, number];

// ── palette ───────────────────────────────────────────────────────────────────
const BRAND:    RGB = [30, 64, 175];     // indigo-800
const BRAND_LT: RGB = [99, 102, 241];    // indigo-500
const LIGHT:    RGB = [238, 242, 255];   // indigo-100
const SLATE_50: RGB = [248, 250, 252];
const GRAY:     RGB = [107, 114, 128];   // gray-500
const LGRAY:    RGB = [209, 213, 219];   // gray-300
const WHITE:    RGB = [255, 255, 255];
const DARK:     RGB = [15, 23, 42];      // slate-900
const MUTED:    RGB = [148, 163, 184];   // slate-400
const INDIGO_2: RGB = [199, 210, 254];   // indigo-200
const GREEN:    RGB = [22, 163, 74];
const GREEN_LT: RGB = [220, 252, 231];
const RED:      RGB = [220, 38, 38];
const RED_LT:   RGB = [254, 226, 226];
const AMBER:    RGB = [217, 119, 6];
const AMBER_LT: RGB = [254, 243, 199];
const SKY:      RGB = [2, 132, 199];     // sky-600

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

function addrBlock(a: {
  street: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
}): string[] {
  return [
    a.street,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    a.county,
    a.country,
  ].filter(Boolean) as string[];
}

function statusStyle(status: string): { bg: RGB; fg: RGB; label: string } {
  const s = (status ?? "").toUpperCase();
  switch (s) {
    case "PAID":             return { bg: GREEN, fg: WHITE, label: "PAID" };
    case "OVERDUE":          return { bg: RED,   fg: WHITE, label: "OVERDUE" };
    case "PARTIALLY_PAID":   return { bg: AMBER, fg: WHITE, label: "PARTIAL" };
    case "CANCELLED":        return { bg: GRAY,  fg: WHITE, label: "CANCELLED" };
    case "SENT":             return { bg: SKY,   fg: WHITE, label: "SENT" };
    case "DRAFT":            return { bg: GRAY,  fg: WHITE, label: "DRAFT" };
    case "PENDING":          return { bg: AMBER, fg: WHITE, label: "PENDING" };
    default:                 return { bg: BRAND, fg: WHITE, label: s.replace(/_/g, " ") || "ISSUED" };
  }
}

/**
 * jsPDF ships only the 14 standard PDF fonts (Helvetica, Times, Courier, etc.)
 * which cover Latin-1 (ISO-8859-1). Characters outside that range — including
 * Romanian diacritics (ă â î ș ț and uppercase) — are silently dropped.
 *
 * Until a full Unicode TTF font is embedded, we transliterate to the closest
 * ASCII equivalent so the text stays readable.
 */
/**
 * Maps every non-Latin-1 character to its ASCII equivalent.
 * jsPDF's built-in Helvetica/Times fonts only cover Latin-1; anything outside
 * that range is silently dropped. We use an explicit lookup table so that
 * Romanian diacritics (ă â î ș ț and their uppercase variants) are preserved
 * as readable ASCII instead of disappearing.
 */
const CHAR_MAP: Record<string, string> = {
  // Romanian – lowercase
  "\u0103": "a", // ă
  "\u00e2": "a", // â
  "\u00ee": "i", // î
  "\u0219": "s", // ș (comma below)
  "\u015f": "s", // ş (cedilla – legacy)
  "\u021b": "t", // ț (comma below)
  "\u0163": "t", // ţ (cedilla – legacy)
  // Romanian – uppercase
  "\u0102": "A", // Ă
  "\u00c2": "A", // Â
  "\u00ce": "I", // Î
  "\u0218": "S", // Ș
  "\u015e": "S", // Ş
  "\u021a": "T", // Ț
  "\u0162": "T", // Ţ
  // Latin Extended – lowercase
  "\u00e0": "a", "\u00e1": "a", "\u00e3": "a", "\u00e5": "a",
  "\u00e4": "a", // ä
  "\u00e6": "ae",
  "\u00e7": "c", // ç
  "\u00e8": "e", "\u00e9": "e", "\u00ea": "e", "\u00eb": "e",
  "\u00ec": "i", "\u00ed": "i", "\u00ef": "i",
  "\u00f0": "d",
  "\u00f1": "n", // ñ
  "\u00f2": "o", "\u00f3": "o", "\u00f4": "o", "\u00f5": "o",
  "\u00f6": "o", "\u00f8": "o",
  "\u00f9": "u", "\u00fa": "u", "\u00fb": "u", "\u00fc": "u",
  "\u00fd": "y", "\u00ff": "y",
  "\u00fe": "th","\u00df": "ss",
  // Latin Extended – uppercase
  "\u00c0": "A", "\u00c1": "A", "\u00c3": "A", "\u00c5": "A",
  "\u00c4": "A", // Ä
  "\u00c6": "AE",
  "\u00c7": "C", // Ç
  "\u00c8": "E", "\u00c9": "E", "\u00ca": "E", "\u00cb": "E",
  "\u00cc": "I", "\u00cd": "I", "\u00cf": "I",
  "\u00d0": "D",
  "\u00d1": "N", // Ñ
  "\u00d2": "O", "\u00d3": "O", "\u00d4": "O", "\u00d5": "O",
  "\u00d6": "O", "\u00d8": "O",
  "\u00d9": "U", "\u00da": "U", "\u00db": "U", "\u00dc": "U",
  "\u00dd": "Y", "\u00de": "TH",
  // Typographic punctuation
  "\u2018": "'", "\u2019": "'",   // ' '
  "\u201c": '"', "\u201d": '"',   // " "
  "\u2013": "-", "\u2014": "-",   // en/em dash
  "\u2026": "...",                // ellipsis
  "\u00ab": '"', "\u00bb": '"',   // « »
  "\u2022": "-",                  // bullet
};

function sanitize(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => CHAR_MAP[c] ?? "?");
}

// truncate text so it fits a given width at current font
function truncate(doc: jsPDF, text: string, maxW: number): string {
  const safe = sanitize(text);
  if (doc.getTextWidth(safe) <= maxW) return safe;
  const ellipsis = "...";
  let lo = 0, hi = safe.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.getTextWidth(safe.slice(0, mid) + ellipsis) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return safe.slice(0, lo) + ellipsis;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export function renderInvoicePdf(inv: InvoiceForPdf): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W  = doc.internal.pageSize.getWidth();   // 210
  const H  = doc.internal.pageSize.getHeight();  // 297
  const ML = 15;
  const MR = 15;

  const sc       = statusStyle(inv.status);
  const remaining = inv.total - inv.paidAmount;
  const isPaid   = remaining <= 0.005;

  // ── HEADER ────────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 34, "F");
  // accent strip
  doc.setFillColor(...BRAND_LT);
  doc.rect(0, 0, W, 3, "F");

  // Logo or company name (top-left)
  if (inv.logoBase64 && inv.logoFormat) {
    try {
      // Draw logo square (28×28 mm) with slight padding from top
      doc.addImage(inv.logoBase64, inv.logoFormat, ML, 3.5, 27, 27);
      // Company name next to logo
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...WHITE);
      const nameX = ML + 31;
      const companyName = truncate(doc, sanitize(inv.company.name).toUpperCase(), W * 0.45);
      doc.text(companyName, nameX, 14);
      doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(...INDIGO_2);
      const contact = [inv.company.email, inv.company.phone].filter(Boolean).map((s) => sanitize(s as string)).join("   .   ");
      if (contact) doc.text(truncate(doc, contact, W * 0.45), nameX, 22);
    } catch {
      // fallback to text only
      doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...WHITE);
      doc.text(truncate(doc, sanitize(inv.company.name).toUpperCase(), W * 0.55), ML, 15);
    }
  } else {
    // Company name (truncated if absurdly long)
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...WHITE);
    const companyName = truncate(doc, sanitize(inv.company.name).toUpperCase(), W * 0.55);
    doc.text(companyName, ML, 15);
    // Contact line
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(...INDIGO_2);
    const contact = [inv.company.email, inv.company.phone].filter(Boolean).map((s) => sanitize(s as string)).join("   .   ");
    if (contact) {
      doc.text(truncate(doc, contact, W * 0.55), ML, 24);
    }
  }

  // INVOICE wordmark
  doc.setFontSize(26).setFont("helvetica", "bold").setTextColor(...WHITE);
  doc.text("INVOICE", W - MR, 17, { align: "right" });

  // Invoice number (smaller, under wordmark)
  doc.setFontSize(9.5).setFont("helvetica", "bold").setTextColor(...INDIGO_2);
  doc.text(`No. ${sanitize(inv.number)}`, W - MR, 24, { align: "right" });

  // ── META BAR ──────────────────────────────────────────────────────────────
  const metaY = 34;
  const metaH = 20;
  doc.setFillColor(...SLATE_50);
  doc.rect(0, metaY, W, metaH, "F");
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.25);
  doc.line(0, metaY + metaH, W, metaY + metaH);

  // Status badge (right side) — measured to fit label
  doc.setFont("helvetica", "bold").setFontSize(8);
  const badgeText = sc.label;
  const badgeTextW = doc.getTextWidth(badgeText);
  const badgeW = Math.max(28, badgeTextW + 10);
  const badgeH = 8.5;
  const badgeX = W - MR - badgeW;
  const badgeY = metaY + (metaH - badgeH) / 2;
  doc.setFillColor(...sc.bg);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2, badgeH / 2, "F");
  doc.setTextColor(...sc.fg);
  doc.text(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.6, { align: "center" });

  // Meta items — only issue date
  const metaItems = [
    { label: "ISSUE DATE", value: fmtDate(inv.issueDate) },
  ];
  const metaAvail = badgeX - ML - 6;
  const metaColW  = metaAvail / metaItems.length;
  metaItems.forEach((m, i) => {
    const x = ML + i * metaColW;
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...GRAY);
    doc.text(m.label, x, metaY + 8);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...DARK);
    doc.text(m.value, x, metaY + 15);
  });

  // ── PARTY BOXES ───────────────────────────────────────────────────────────
  const boxTop = metaY + metaH + 8;   // 62
  const boxH   = 52;
  const boxGap = 6;
  const halfW  = (W - ML - MR - boxGap) / 2;

  function drawPartyBox(x: number, tag: string, name: string, lines: string[]) {
    // Main box
    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, boxTop, halfW, boxH, 3, 3, "FD");

    // Left accent bar (solid rect inside the rounded box — clipped visually)
    doc.setFillColor(...BRAND);
    doc.rect(x, boxTop + 1, 2.5, boxH - 2, "F");

    const innerX = x + 7;
    const innerW = halfW - 10;

    // Tag label
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BRAND_LT);
    doc.text(tag, innerX, boxTop + 7);

    // Name (one line, truncated)
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DARK);
    doc.text(truncate(doc, sanitize(name), innerW), innerX, boxTop + 14);

    // Divider
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.2);
    doc.line(innerX, boxTop + 17.5, x + halfW - 4, boxTop + 17.5);

    // Detail lines
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
    const maxLines = 5;
    let ly = boxTop + 23;
    lines.slice(0, maxLines).forEach((l) => {
      doc.text(truncate(doc, sanitize(l), innerW), innerX, ly);
      ly += 5;
    });
  }

  const supplierLines = [
    ...addrBlock(inv.company),
  ].filter(Boolean) as string[];

  const customerLines = [
    ...addrBlock(inv.customer),
  ].filter(Boolean) as string[];

  drawPartyBox(ML, "FROM", inv.company.name, supplierLines);
  drawPartyBox(ML + halfW + boxGap, "BILL TO", inv.customer.name, customerLines);

  let cursorY = boxTop + boxH + 10;

  // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BRAND_LT);
  doc.text("LINE ITEMS", ML, cursorY);
  cursorY += 3;

  const items: Item[] = Array.isArray(inv.items) ? (inv.items as Item[]) : [];
  const rows = items.map((it, i) => [
    String(i + 1),
    sanitize(it.description),
    fmtMoney(it.quantity * it.unitPrice, inv.currency),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Description", "Amount"]],
    body: rows.length ? rows : [["", "No items listed", ""]],
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      textColor: DARK,
      lineColor: [229, 231, 235],
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
      halign: "left",
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10, textColor: GRAY },
      1: { cellWidth: "auto" },
      2: { halign: "right",  cellWidth: 40, fontStyle: "bold" },
    },
    margin: { left: ML, right: MR },
    pageBreak: "auto",
    rowPageBreak: "avoid",
    bodyStyles: { minCellHeight: 9 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTable: number = (doc as any).lastAutoTable?.finalY ?? cursorY + 30;

  // ── TOTALS + NOTES section ────────────────────────────────────────────────
  const sectionTop = afterTable + 10;
  const footerTop  = H - 18;       // reserved for footer
  const sectionAvailH = footerTop - sectionTop - 4;

  // Totals dimensions
  const tbW = 88;
  const tbX = W - MR - tbW;

  const totalsRows: { label: string; value: string; bold?: boolean; hl?: boolean }[] = [
    { label: "Total",                 value: fmtMoney(inv.total,      inv.currency), bold: true },
    { label: "Paid",                  value: fmtMoney(inv.paidAmount, inv.currency) },
    { label: "Balance Due",           value: fmtMoney(remaining,       inv.currency), hl: true },
  ];

  // Compute height: each normal row 8, bold row 9, highlight row 13, top/bottom padding 6
  let totalsH = 6;
  totalsRows.forEach((r) => {
    if (r.hl)        totalsH += 13;
    else if (r.bold) totalsH += 9;
    else             totalsH += 8;
  });

  // Page-break safety: if section won't fit, add a new page
  if (sectionTop + totalsH > footerTop - 4) {
    doc.addPage();
  }
  const tY = doc.getCurrentPageInfo().pageNumber > 1 ? 20 : sectionTop;

  // ── Totals box ────────────────────────────────────────────────────────────
  // Outer rounded box
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(tbX, tY, tbW, totalsH, 3, 3, "FD");

  let ry = tY + 8;
  totalsRows.forEach((r) => {
    if (r.hl) {
      // separator
      doc.setDrawColor(...LGRAY);
      doc.setLineWidth(0.3);
      doc.line(tbX + 4, ry - 4.5, tbX + tbW - 4, ry - 4.5);

      // highlighted band (colored background) — drawn inside outer rounded box
      const hlBg = isPaid ? GREEN_LT : RED_LT;
      const hlFg = isPaid ? GREEN    : RED;
      // Inset slightly so we don't overpaint the outer border
      doc.setFillColor(...hlBg);
      doc.roundedRect(tbX + 0.4, ry - 4, tbW - 0.8, 12, 2.5, 2.5, "F");

      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...hlFg);
      doc.text(r.label, tbX + 5, ry + 3.5);
      doc.text(r.value, tbX + tbW - 5, ry + 3.5, { align: "right" });
      ry += 13;
      return;
    }

    if (r.bold) {
      doc.setDrawColor(...LGRAY);
      doc.setLineWidth(0.3);
      doc.line(tbX + 4, ry - 4.5, tbX + tbW - 4, ry - 4.5);

      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DARK);
      doc.text(r.label, tbX + 5, ry);
      doc.text(r.value, tbX + tbW - 5, ry, { align: "right" });
      ry += 9;
      return;
    }

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRAY);
    doc.text(r.label, tbX + 5, ry);
    doc.setTextColor(...DARK);
    doc.text(r.value, tbX + tbW - 5, ry, { align: "right" });
    ry += 8;
  });

  // ── PAID stamp watermark ──────────────────────────────────────────────────
  if (isPaid) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docAny = doc as any;
      docAny.saveGraphicsState();
      docAny.setGState(new docAny.GState({ opacity: 0.10 }));
      doc.setFont("helvetica", "bold").setFontSize(60).setTextColor(...GREEN);
      doc.text("PAID", W / 2 - 10, H / 2 + 10, { align: "center", angle: 20 });
      docAny.restoreGraphicsState();
    } catch {
      /* opacity not supported — skip stamp */
    }
  }

  // ── NOTES (left of totals) ────────────────────────────────────────────────
  if (inv.notes) {
    const notesX  = ML;
    const notesY  = tY;
    const notesW  = tbX - ML - 8;
    // height adapts but capped to totals height
    const notesH  = Math.min(totalsH, 60);

    doc.setFillColor(...SLATE_50);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.roundedRect(notesX, notesY, notesW, notesH, 3, 3, "FD");

    // Left accent bar
    doc.setFillColor(...BRAND_LT);
    doc.rect(notesX, notesY + 1, 2.5, notesH - 2, "F");

    // Label
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...BRAND_LT);
    doc.text("NOTES", notesX + 7, notesY + 7);

    // Body
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRAY);
    const innerW = notesW - 12;
    const split  = doc.splitTextToSize(sanitize(inv.notes), innerW) as string[];
    // limit to lines that fit
    const lineH    = 4.5;
    const maxLines = Math.max(1, Math.floor((notesH - 12) / lineH));
    const shown    = split.slice(0, maxLines);
    let ny = notesY + 12;
    shown.forEach((l) => {
      doc.text(l, notesX + 7, ny);
      ny += lineH;
    });
    if (split.length > maxLines) {
      doc.setTextColor(...MUTED).setFontSize(7);
      doc.text("…", notesX + 7, ny);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER  (on EVERY page)
  // ══════════════════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    // Accent line
    doc.setFillColor(...BRAND_LT);
    doc.rect(0, H - 16, W, 1.5, "F");

    // Footer band
    doc.setFillColor(...BRAND);
    doc.rect(0, H - 14.5, W, 14.5, "F");

    // Left: thank you
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...INDIGO_2);
    doc.text("Thank you for your business!", ML, H - 8.5);

    // Center: company info (truncated to fit)
    const centerText = [inv.company.name, inv.company.email, inv.company.phone]
      .filter(Boolean)
      .map((s) => sanitize(s as string))
      .join("   .   ");
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...INDIGO_2);
    doc.text(truncate(doc, centerText, W - 100), W / 2, H - 8.5, { align: "center" });

    // Right: page numbering
    doc.setFontSize(7).setTextColor(...INDIGO_2);
    doc.text(`Page ${p} / ${pageCount}`, W - MR, H - 8.5, { align: "right" });

    // Bottom strip: generation date + invoice number
    doc.setFontSize(6.5).setTextColor(...MUTED);
    doc.text(`Generated ${fmtDate(new Date())}`, ML, H - 3);
    doc.text(`Invoice ${sanitize(inv.number)}`, W - MR, H - 3, { align: "right" });
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
