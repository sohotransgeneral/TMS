/**
 * scripts/delete-loads.mjs
 *
 * Deletes loads in bulk. Written for clearing out test loads before going live.
 *
 *   node scripts/delete-loads.mjs                    # dry run — shows what WOULD go
 *   node scripts/delete-loads.mjs --yes              # actually delete
 *   node scripts/delete-loads.mjs --company=<id>     # limit to one company
 *   node scripts/delete-loads.mjs --yes --include-invoiced
 *
 * Deliberately conservative, because this is not undoable:
 *   - dry run is the default; nothing is touched without --yes
 *   - refuses to run across several companies unless --company or --all-companies
 *     is given, so one tenant's data can't take another's with it
 *   - skips invoiced loads unless --include-invoiced: the invoice would survive
 *     pointing at nothing and the money would stop tracing back to a trip
 *   - expenses and fuel entries are kept, only unlinked, so booked costs stay
 *     in the accounting
 *
 * Removed with each load: status history, attached documents, GPS trail.
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
};

const execute = has("--yes");
const includeInvoiced = has("--include-invoiced");
const allCompanies = has("--all-companies");
const companyId = valueOf("--company");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set (put it in .env.local).");
    process.exit(1);
  }

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  if (!companyId && !allCompanies && companies.length > 1) {
    console.error(
      `✗ ${companies.length} companies in this database. Pick one with --company=<id>, or pass --all-companies on purpose:\n` +
        companies.map((c) => `    ${c.id}  ${c.name}`).join("\n"),
    );
    process.exit(1);
  }

  const where = companyId ? { companyId } : {};
  const loads = await prisma.load.findMany({
    where,
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      companyId: true,
      invoice: { select: { number: true } },
    },
    orderBy: { referenceNumber: "asc" },
  });

  if (loads.length === 0) {
    console.log("Nothing to delete — no loads matched.");
    return;
  }

  const invoiced = loads.filter((l) => l.invoice);
  const target = includeInvoiced ? loads : loads.filter((l) => !l.invoice);
  const ids = target.map((l) => l.id);

  const byStatus = {};
  for (const l of target) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

  const [documents, history, gps, expenses, fuel] = await Promise.all([
    prisma.document.count({ where: { loadId: { in: ids } } }),
    prisma.loadStatusHistory.count({ where: { loadId: { in: ids } } }),
    prisma.gPSLocation.count({ where: { loadId: { in: ids } } }),
    prisma.expense.count({ where: { loadId: { in: ids } } }),
    prisma.fuelEntry.count({ where: { loadId: { in: ids } } }),
  ]);

  console.log(`\nScope: ${companyId ? `company ${companyId}` : "ALL companies"}`);
  console.log(`Loads matched:        ${loads.length}`);
  console.log(`Loads to delete:      ${target.length}`);
  console.log(
    `  by status:          ${
      Object.entries(byStatus)
        .map(([s, n]) => `${s}=${n}`)
        .join(", ") || "—"
    }`,
  );
  console.log(`\nDeleted along with them:`);
  console.log(`  status history:     ${history}`);
  console.log(`  documents:          ${documents}`);
  console.log(`  GPS points:         ${gps}`);
  console.log(`\nKept, only unlinked:`);
  console.log(`  expenses:           ${expenses}`);
  console.log(`  fuel entries:       ${fuel}`);

  if (invoiced.length) {
    console.log(
      `\n${includeInvoiced ? "⚠ DELETING" : "Skipped"} ${invoiced.length} invoiced load(s):`,
    );
    for (const l of invoiced.slice(0, 20)) {
      console.log(`  ${l.referenceNumber} → invoice ${l.invoice.number}`);
    }
    if (invoiced.length > 20) console.log(`  … and ${invoiced.length - 20} more`);
    if (!includeInvoiced) {
      console.log("  (pass --include-invoiced to delete these too)");
    }
  }

  if (!execute) {
    console.log(`\nDRY RUN — nothing was changed. Re-run with --yes to delete.`);
    return;
  }

  if (ids.length === 0) {
    console.log("\nNothing left to delete after skipping invoiced loads.");
    return;
  }

  console.log(`\nDeleting ${ids.length} load(s)…`);
  await prisma.document.deleteMany({ where: { loadId: { in: ids } } });
  await prisma.loadStatusHistory.deleteMany({ where: { loadId: { in: ids } } });
  await prisma.gPSLocation.deleteMany({ where: { loadId: { in: ids } } });
  await prisma.expense.updateMany({
    where: { loadId: { in: ids } },
    data: { loadId: null },
  });
  await prisma.fuelEntry.updateMany({
    where: { loadId: { in: ids } },
    data: { loadId: null },
  });
  if (includeInvoiced) {
    await prisma.invoice.updateMany({
      where: { loadId: { in: ids } },
      data: { loadId: null },
    });
  }
  const { count } = await prisma.load.deleteMany({ where: { id: { in: ids } } });

  console.log(`✅ Deleted ${count} load(s).`);
}

main()
  .catch((err) => {
    console.error("✗ Failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
