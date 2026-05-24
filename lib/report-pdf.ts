import "server-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}
function fmtMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("ro-RO", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

type ReportData = {
  companyName: string;
  generatedAt: Date;
  invoices: { number: string; date: Date; customer: string; total: number; paid: number; status: string }[];
  paymentsSummary: { count: number; total: number };
  loads: { ref: string; customer: string; status: string; price: number; currency: string; date: Date }[];
  expenses: { description: string; type: string; amount: number; date: Date }[];
  fuelSummary: { count: number; liters: number; amount: number };
  fleetCount: number;
  driverCount: number;
};

export function renderReportPdf(data: ReportData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;

  // ── Title ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("OPERATIONAL REPORT", M, 18);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Company: ${data.companyName}`, M, 26);
  doc.text(`Generat: ${fmtDate(data.generatedAt)}`, M, 31);

  // ── KPI summary ────────────────────────────────────────────
  let y = 42;
  doc.setFont("helvetica", "bold").setFontSize(12).text("Sumar", M, y);
  y += 6;
  const kpis = [
    ["Facturi (an)", `${data.invoices.length} facturi · ${fmtMoney(data.invoices.reduce((s, i) => s + i.total, 0))} total`],
    ["Payments (year)", `${data.paymentsSummary.count} payments · ${fmtMoney(data.paymentsSummary.total)}`],
    ["Curse (30 zile)", `${data.loads.length} curse`],
    ["Fleet", `${data.fleetCount} trucks · ${data.driverCount} drivers`],
    ["Combustibil (total)", `${data.fuelSummary.liters.toFixed(0)} L · ${fmtMoney(data.fuelSummary.amount)}`],
    ["Cheltuieli aprobate (an)", fmtMoney(data.expenses.reduce((s, e) => s + e.amount, 0))],
  ];
  doc.setFont("helvetica", "normal").setFontSize(10);
  kpis.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold").text(`${k}:`, M, y);
    doc.setFont("helvetica", "normal").text(v, M + 55, y);
    y += 6;
  });

  // ── Invoices table ─────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "bold").setFontSize(12).text("Facturi (an curent)", M, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Number", "Client", "Data", "Total", "Paid", "Status"]],
    body: data.invoices.map((i) => [
      i.number,
      i.customer,
      fmtDate(i.date),
      fmtMoney(i.total),
      fmtMoney(i.paid),
      i.status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
    margin: { left: M, right: M },
  });

  // ── Loads table ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 10;
  doc.setFont("helvetica", "bold").setFontSize(12).text("Curse (ultimele 30 zile)", M, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Reference", "Client", "Data", "Price", "Status"]],
    body: data.loads.map((l) => [
      l.ref,
      l.customer,
      fmtDate(l.date),
      fmtMoney(l.price, l.currency),
      l.status,
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
    margin: { left: M, right: M },
  });

  // ── Expenses table ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable?.finalY + 10;
  doc.setFont("helvetica", "bold").setFontSize(12).text("Cheltuieli aprobate (an curent)", M, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Type", "Data", "Amount"]],
    body: data.expenses.map((e) => [
      e.description,
      e.type,
      fmtDate(e.date),
      fmtMoney(e.amount),
    ]),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8 },
    margin: { left: M, right: M },
  });

  // ── Footer ─────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8).setTextColor(150);
    doc.text(`${data.companyName} · Raport generat ${fmtDate(data.generatedAt)} · Pagina ${p}/${pages}`, M, ph - 6);
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
