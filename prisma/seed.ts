/**
 * Full demo seed for TMS — rich dataset.
 *
 * Per company:
 *   • 1 admin, 2 dispatchers, 1 accountant, 1 fleet manager
 *   • 6 drivers with profiles
 *   • 6 trucks, 4 trailers
 *   • 8 customers
 *   • 40 loads spread over last 90 days (varied statuses)
 *   • invoices for delivered/invoiced/paid loads + 6 standalone
 *   • payments for paid/partial invoices
 *   • 30 expenses, 30 fuel entries, 6 maintenance records
 *   • notifications + audit log
 *
 * Idempotent: re-running is safe.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Demo1234!";

/* ─── helpers ─────────────────────────────────────────────── */
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}
function daysFromNow(n: number, base = new Date()) {
  return new Date(base.getTime() + n * 86_400_000);
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, dp = 2) {
  return +((Math.random() * (max - min) + min).toFixed(dp));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ─── user upsert ──────────────────────────────────────────── */
async function ensureUser(args: {
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "COMPANY_ADMIN" | "DISPATCHER" | "DRIVER" | "ACCOUNTANT" | "FLEET_MANAGER" | "CUSTOMER";
  companyId?: string | null;
  phone?: string;
  password?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: args.email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: args.email,
      name: args.name,
      role: args.role,
      companyId: args.companyId ?? undefined,
      phone: args.phone,
      password: await bcrypt.hash(args.password ?? PASSWORD, 10),
      active: true,
    },
  });
}

/* ─── reference data ──────────────────────────────────────── */
const ROUTES: { from: [string, number, number]; to: [string, number, number]; distKm: number }[] = [
  { from: ["București",   44.4268, 26.1025], to: ["Cluj-Napoca",  46.7712, 23.6236], distKm: 460 },
  { from: ["Timișoara",   45.7489, 21.2087], to: ["Iași",         47.1585, 27.6014], distKm: 620 },
  { from: ["Constanța",   44.1598, 28.6348], to: ["Brașov",       45.6427, 25.5887], distKm: 310 },
  { from: ["Sibiu",       45.7983, 24.1256], to: ["Oradea",       47.0722, 21.9217], distKm: 330 },
  { from: ["Craiova",     44.3302, 23.7949], to: ["Galați",       45.4353, 28.0080], distKm: 380 },
  { from: ["Ploiești",    44.9397, 26.0226], to: ["Suceava",      47.6350, 26.2535], distKm: 410 },
  { from: ["Bacău",       46.5671, 26.9146], to: ["Deva",         45.8831, 22.9069], distKm: 510 },
  { from: ["Pitești",     44.8565, 24.8693], to: ["Baia Mare",    47.6567, 23.5681], distKm: 570 },
  { from: ["București",   44.4268, 26.1025], to: ["Timișoara",    45.7489, 21.2087], distKm: 545 },
  { from: ["Cluj-Napoca", 46.7712, 23.6236], to: ["Constanța",    44.1598, 28.6348], distKm: 490 },
  { from: ["Iași",        47.1585, 27.6014], to: ["Craiova",      44.3302, 23.7949], distKm: 590 },
  { from: ["Brașov",      45.6427, 25.5887], to: ["Timișoara",    45.7489, 21.2087], distKm: 370 },
];

const CARGO = [
  "Bunuri ambalate general",
  "Produse alimentare refrigerate",
  "Materiale construcții",
  "Electrocasnice",
  "Mobilier",
  "Piese auto",
  "Produse chimice industriale",
  "Textile și îmbrăcăminte",
  "Echipamente IT",
  "Produse farmaceutice",
];

const TRUCK_MAKES = [
  { make: "MAN",      models: ["TGX 18.500", "TGX 18.440", "TGS 26.400"] },
  { make: "Volvo",    models: ["FH 460", "FH 500", "FM 370"] },
  { make: "Mercedes", models: ["Actros 1845", "Actros 1863", "Arocs 2543"] },
  { make: "DAF",      models: ["XF 480", "XF 530", "CF 340"] },
  { make: "Scania",   models: ["R 450", "R 500", "S 580"] },
  { make: "Iveco",    models: ["S-Way 480", "Stralis 460"] },
];

const STATIONS = [
  "OMV Sibiu Nord", "Petrom Pitești", "Rompetrol Brașov", "MOL Cluj",
  "Socar Timișoara", "OMV București A1", "Petrom Ploiești", "Lukoil Constanța",
  "MOL Oradea", "Rompetrol Galați",
];

const EXPENSE_DESCS: Record<string, string[]> = {
  FUEL:    ["Adblue 40L", "Aditiv combustibil"],
  TOLL:    ["Taxă autostradă A1", "Taxă A2 Cernavodă", "Vignetă Austria", "Taxă pod Fetești", "Taxă A3 Cluj"],
  PARKING: ["Parcare TIR Sibiu", "Parcare securizată Timișoara", "Parcare nocturnă București"],
  REPAIR:  ["Schimb anvelopă față", "Reparație frână spate", "Înlocuire alternator", "Schimb curea distribuție", "Reparație sistem ABS"],
  OTHER:   ["Spălare TIR", "Dezinfecție trailer", "Taxi șofer urgență", "Cazare motel rutier", "Revizie 50.000 km"],
};

/* ─── main company seeder ─────────────────────────────────── */
async function seedCompany(opts: {
  name: string;
  legalName: string;
  taxId: string;
  adminEmail: string;
  city: string;
  country: string;
  invoicePrefix: string;
  currency: string;
}) {
  /* Company */
  let company = await prisma.company.findFirst({ where: { name: opts.name } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: opts.name,
        legalName: opts.legalName,
        taxId: opts.taxId,
        registrationNumber: `J${randInt(1, 40)}/${randInt(100, 9999)}/2019`,
        email: `office@${opts.name.toLowerCase().replace(/[\s.]+/g, "")}.com`,
        phone: "+40 723 000 001",
        street: "Calea Victoriei 1",
        city: opts.city,
        county: opts.city,
        postalCode: "010001",
        country: opts.country,
        bankName: "Banca Transilvania",
        bankAccount: `RO49AAAA1B${randInt(10000, 99999)}0000000001`,
        currency: opts.currency,
        vatRate: 20,
        invoicePrefix: opts.invoicePrefix,
        invoiceCounter: 0,
        subscriptionStatus: "ACTIVE",
        subscriptionPlan: "pro",
      },
    });
  }
  const cid = company.id;

  /* Staff */
  const admin = await ensureUser({ email: opts.adminEmail, name: `Admin ${opts.name}`, role: "COMPANY_ADMIN", companyId: cid });
  const disp1 = await ensureUser({ email: `disp1.${opts.invoicePrefix.toLowerCase()}@tms.local`, name: "Andrei Ionescu", role: "DISPATCHER", companyId: cid, phone: "+40721000001" });
  const disp2 = await ensureUser({ email: `disp2.${opts.invoicePrefix.toLowerCase()}@tms.local`, name: "Elena Matei", role: "DISPATCHER", companyId: cid, phone: "+40721000002" });
  const accountant = await ensureUser({ email: `contabil.${opts.invoicePrefix.toLowerCase()}@tms.local`, name: "Maria Contabil", role: "ACCOUNTANT", companyId: cid });
  const fleetMgr = await ensureUser({ email: `flota.${opts.invoicePrefix.toLowerCase()}@tms.local`, name: "Ion Flotă", role: "FLEET_MANAGER", companyId: cid });

  /* Drivers */
  const driverDefs = [
    { first: "Vasile",    last: "Popescu",    phone: "+40731000001", km: 0.13 },
    { first: "Gheorghe",  last: "Ionescu",    phone: "+40731000002", km: 0.12 },
    { first: "Marian",    last: "Dumitru",    phone: "+40731000003", km: 0.14 },
    { first: "Florin",    last: "Constantin", phone: "+40731000004", km: 0.12 },
    { first: "Mihai",     last: "Popa",       phone: "+40731000005", km: 0.11 },
    { first: "Alexandru", last: "Radu",       phone: "+40731000006", km: 0.13 },
  ];
  const driverProfiles: { id: string; firstName: string; lastName: string }[] = [];
  for (const d of driverDefs) {
    const email = `${d.first.toLowerCase()}.${opts.invoicePrefix.toLowerCase()}@tms.local`;
    const user = await ensureUser({ email, name: `${d.first} ${d.last}`, role: "DRIVER", companyId: cid, phone: d.phone });
    let profile = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.driverProfile.create({
        data: {
          companyId: cid,
          userId: user.id,
          firstName: d.first,
          lastName: d.last,
          cnp: `${randInt(1, 2)}${String(randInt(70, 99))}${String(randInt(1, 12)).padStart(2, "0")}${String(randInt(1, 28)).padStart(2, "0")}${randInt(100000, 999999)}`,
          dateOfBirth: daysAgo(randInt(25 * 365, 50 * 365)),
          licenseNumber: `B${randInt(100000, 999999)}`,
          licenseCategories: ["B", "C", "CE"],
          licenseIssuedAt: daysAgo(randInt(1000, 5000)),
          licenseExpiresAt: daysFromNow(randInt(60, 1200)),
          tachoCardNumber: `RO${randInt(10000000, 99999999)}`,
          tachoCardExpiresAt: daysFromNow(randInt(30, 900)),
          employedSince: daysAgo(randInt(200, 2000)),
          salaryPerKm: d.km,
          commissionRate: 5,
          rating: randFloat(3.8, 5.0, 1),
          status: pick(["AVAILABLE", "AVAILABLE", "ON_TRIP", "ON_TRIP", "OFF_DUTY"] as const),
          internalNotes: Math.random() > 0.7 ? "Preferă rute de noapte." : null,
        },
      });
    }
    driverProfiles.push({ id: profile.id, firstName: d.first, lastName: d.last });
  }

  /* Trucks */
  const trucks: { id: string; plateNumber: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const plate = `${opts.invoicePrefix}-0${i}-TMS`;
    let truck = await prisma.truck.findFirst({ where: { companyId: cid, plateNumber: plate } });
    if (!truck) {
      const brand = pick(TRUCK_MAKES);
      truck = await prisma.truck.create({
        data: {
          companyId: cid,
          plateNumber: plate,
          vin: `WDB${randInt(100000000, 999999999)}${randInt(10, 99)}`,
          make: brand.make,
          model: pick(brand.models),
          year: randInt(2017, 2024),
          color: pick(["Alb", "Gri", "Negru", "Albastru"]),
          mileage: randInt(80000, 900000),
          fuelType: "diesel",
          avgConsumption: randFloat(27, 36, 1),
          insuranceExpiresAt: daysFromNow(randInt(-15, 400)),
          itpExpiresAt: daysFromNow(randInt(-5, 400)),
          vignetteExpiresAt: daysFromNow(randInt(5, 365)),
          tachographExpiresAt: daysFromNow(randInt(10, 700)),
          status: pick(["AVAILABLE", "AVAILABLE", "ON_TRIP", "ON_TRIP", "IN_SERVICE"] as const),
        },
      });
    }
    trucks.push(truck);
  }

  /* Trailers */
  const trailerTypes = ["tilt", "reefer", "flatbed", "tanker"] as const;
  const trailers: { id: string; plateNumber: string }[] = [];
  for (let i = 1; i <= 4; i++) {
    const plate = `${opts.invoicePrefix}-R${i}-TMS`;
    let trailer = await prisma.trailer.findFirst({ where: { companyId: cid, plateNumber: plate } });
    if (!trailer) {
      trailer = await prisma.trailer.create({
        data: {
          companyId: cid,
          plateNumber: plate,
          type: trailerTypes[(i - 1) % trailerTypes.length],
          capacityKg: pick([22000, 24000, 26000]),
          volumeM3: pick([82, 86, 90]),
          axles: 3,
          yearOfManufacture: randInt(2016, 2023),
          insuranceExpiresAt: daysFromNow(randInt(10, 400)),
          itpExpiresAt: daysFromNow(randInt(10, 400)),
          status: pick(["AVAILABLE", "AVAILABLE", "ON_TRIP"] as const),
        },
      });
    }
    trailers.push(trailer);
  }

  /* Customers */
  const customerDefs = [
    { name: "Carrefour România",    taxId: "RO11588780", city: "București",   payDays: 30 },
    { name: "Auchan România",        taxId: "RO15531222", city: "Cluj-Napoca", payDays: 45 },
    { name: "Lidl Discount",         taxId: "RO15300120", city: "Timișoara",   payDays: 30 },
    { name: "Profi Rom Food",        taxId: "RO14984973", city: "Brașov",      payDays: 30 },
    { name: "Penny România",         taxId: "RO16454059", city: "Iași",        payDays: 60 },
    { name: "Dedeman SRL",           taxId: "RO6480039",  city: "Bacău",       payDays: 30 },
    { name: "Altex România",         taxId: "RO3741745",  city: "Craiova",     payDays: 45 },
    { name: "Arabesque Distribuție", taxId: "RO4204820",  city: "Sibiu",       payDays: 30 },
  ];
  const customers: { id: string; name: string }[] = [];
  for (const c of customerDefs) {
    let cust = await prisma.customer.findFirst({ where: { companyId: cid, name: c.name } });
    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyId: cid,
          name: c.name,
          contactPerson: "Departament Logistică",
          email: `logistica@${c.name.split(" ")[0].toLowerCase()}.ro`,
          phone: "+40 21 000 0000",
          taxId: c.taxId,
          registrationNumber: `J${randInt(1, 40)}/${randInt(100, 9999)}/2015`,
          street: "Bd. Industriilor 100",
          city: c.city,
          county: c.city,
          country: "RO",
          paymentTermsDays: c.payDays,
          creditLimit: randInt(50000, 300000),
        },
      });
    }
    customers.push(cust);
  }

  /* ── Loads ────────────────────────────────────────────────── */
  const existingLoads = await prisma.load.count({ where: { companyId: cid } });
  const loadIdsForInvoice: string[] = [];

  if (existingLoads < 10) {
    const statusPool = [
      "DRAFT", "ASSIGNED", "ASSIGNED",
      "IN_TRANSIT", "IN_TRANSIT", "IN_TRANSIT",
      "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
      "INVOICED", "INVOICED", "INVOICED",
      "PAID", "PAID",
      "CANCELLED",
    ] as const;

    for (let i = 0; i < 40; i++) {
      const route = pick(ROUTES);
      const agoDays = randInt(0, 85);
      const pickupDate = daysAgo(agoDays);
      const status = pick(statusPool);
      const driver = pick(driverProfiles);
      const truck = pick(trucks);
      const trailer = pick(trailers);
      const customer = pick(customers);
      const price = Math.round(route.distKm * randFloat(1.8, 3.2, 2));

      const refNum = `L-2026-${String(i + 1).padStart(4, "0")}-${opts.invoicePrefix}`;
      const existing = await prisma.load.findFirst({ where: { companyId: cid, referenceNumber: refNum } });
      if (existing) {
        if (["DELIVERED", "INVOICED", "PAID"].includes(existing.status)) loadIdsForInvoice.push(existing.id);
        continue;
      }

      const load = await prisma.load.create({
        data: {
          companyId: cid,
          referenceNumber: refNum,
          customerId: customer.id,
          pickupAddress: `Hala ${randInt(1, 5)}, ${route.from[0]}`,
          pickupCity: route.from[0],
          pickupCountry: "RO",
          pickupLat: route.from[1] + (Math.random() - 0.5) * 0.05,
          pickupLng: route.from[2] + (Math.random() - 0.5) * 0.05,
          pickupDate,
          deliveryAddress: `Depozit ${randInt(1, 3)}, ${route.to[0]}`,
          deliveryCity: route.to[0],
          deliveryCountry: "RO",
          deliveryLat: route.to[1] + (Math.random() - 0.5) * 0.05,
          deliveryLng: route.to[2] + (Math.random() - 0.5) * 0.05,
          deliveryDate: daysFromNow(randInt(1, 3), pickupDate),
          cargoDescription: pick(CARGO),
          weightKg: randInt(6000, 24000),
          volumeM3: randInt(20, 88),
          packages: randInt(10, 400),
          price,
          currency: opts.currency,
          estimatedDistanceKm: route.distKm,
          status,
          driverId: status !== "DRAFT" ? driver.id : undefined,
          truckId: status !== "DRAFT" ? truck.id : undefined,
          trailerId: status !== "DRAFT" ? trailer.id : undefined,
          dispatcherId: disp1.id,
          createdById: disp1.id,
        },
      });

      // Status history
      await prisma.loadStatusHistory.create({
        data: { loadId: load.id, status: "DRAFT", changedById: disp1.id, createdAt: pickupDate },
      });
      if (status !== "DRAFT" && status !== "CANCELLED") {
        const flow = ["ASSIGNED", "IN_TRANSIT", "DELIVERED", "INVOICED", "PAID"] as const;
        for (const s of flow) {
          await prisma.loadStatusHistory.create({
            data: {
              loadId: load.id,
              status: s,
              changedById: disp1.id,
              note: `Status: ${s}`,
              lat: s === "DELIVERED" ? route.to[1] : null,
              lng: s === "DELIVERED" ? route.to[2] : null,
              createdAt: daysFromNow(flow.indexOf(s), pickupDate),
            },
          });
          if (s === status) break;
        }
      }

      // GPS pings
      if (["IN_TRANSIT", "DELIVERED", "INVOICED", "PAID"].includes(status)) {
        for (let g = 0; g <= 8; g++) {
          const t = g / 8;
          await prisma.gPSLocation.create({
            data: {
              companyId: cid,
              driverId: driver.id,
              truckId: truck.id,
              loadId: load.id,
              lat: route.from[1] + (route.to[1] - route.from[1]) * t,
              lng: route.from[2] + (route.to[2] - route.from[2]) * t,
              speed: randInt(55, 95),
              heading: randInt(0, 359),
              recordedAt: new Date(pickupDate.getTime() + g * 3_600_000 * (route.distKm / 80)),
            },
          });
        }
      }

      if (["DELIVERED", "INVOICED", "PAID"].includes(status)) {
        loadIdsForInvoice.push(load.id);
      }
    }
  }

  /* ── Invoices ─────────────────────────────────────────────── */
  const existingInvoices = await prisma.invoice.count({ where: { companyId: cid } });
  if (existingInvoices < 5) {
    const invoiceStatuses = [
      "DRAFT", "SENT", "SENT", "SENT",
      "PAID", "PAID", "PAID", "PAID",
      "OVERDUE", "OVERDUE", "OVERDUE",
    ] as const;

    const invoiceTargets = [
      ...loadIdsForInvoice.slice(0, 12).map((id) => ({ loadId: id, customerId: null as string | null })),
      ...Array.from({ length: 6 }, () => ({ loadId: null as string | null, customerId: pick(customers).id })),
    ];

    for (const target of invoiceTargets) {
      if (target.loadId) {
        const ex = await prisma.invoice.findFirst({ where: { loadId: target.loadId } });
        if (ex) continue;
      }

      const seq = await prisma.company.update({
        where: { id: cid },
        data: { invoiceCounter: { increment: 1 } },
        select: { invoiceCounter: true, invoicePrefix: true },
      });
      const number = `${seq.invoicePrefix}-2026-${String(seq.invoiceCounter).padStart(5, "0")}`;
      const invStatus = pick(invoiceStatuses);

      let customerId = target.customerId;
      let subtotal = randInt(800, 12000);
      let pickupCity: string | null = null;
      let deliveryCity: string | null = null;

      if (target.loadId) {
        const load = await prisma.load.findUnique({
          where: { id: target.loadId },
          select: { customerId: true, price: true, pickupCity: true, deliveryCity: true },
        });
        if (!load) continue;
        customerId = load.customerId;
        subtotal = load.price;
        pickupCity = load.pickupCity;
        deliveryCity = load.deliveryCity;
      }
      if (!customerId) continue;

      const vatRate = 20;
      const vatAmount = +(subtotal * vatRate / 100).toFixed(2);
      const total = +(subtotal + vatAmount).toFixed(2);
      const isPaid = invStatus === "PAID";
      const paidAmount = isPaid ? total : 0;
      const issueDate = daysAgo(randInt(0, 60));
      const dueDate = daysFromNow(randInt(-15, 45), issueDate);

      const lineItems: { description: string; quantity: number; unitPrice: number; total: number }[] = [
        {
          description: pickupCity && deliveryCity
            ? `Transport ${pickupCity} → ${deliveryCity}`
            : `Servicii transport marfă — ${issueDate.toLocaleString("ro-RO", { month: "long", year: "numeric" })}`,
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
        },
      ];
      if (Math.random() > 0.5) {
        const extra = randInt(50, 300);
        lineItems.push({ description: "Taxă manipulare marfă", quantity: 1, unitPrice: extra, total: extra });
      }

      const inv = await prisma.invoice.create({
        data: {
          companyId: cid,
          number,
          series: seq.invoicePrefix,
          customerId,
          loadId: target.loadId ?? undefined,
          issueDate,
          dueDate,
          subtotal,
          vatRate,
          vatAmount,
          total,
          currency: opts.currency,
          paidAmount,
          status: invStatus,
          notes: Math.random() > 0.6 ? "Vă rugăm să efectuați plata conform termenilor agreați." : null,
          items: lineItems as never,
        },
      });

      if (isPaid) {
        await prisma.payment.create({
          data: {
            companyId: cid,
            invoiceId: inv.id,
            amount: total,
            currency: opts.currency,
            method: pick(["bank", "bank", "cash", "card"]),
            reference: `OP-${randInt(1000, 9999)}`,
            paidAt: daysAgo(randInt(0, 30)),
          },
        });
      }
    }
  }

  /* ── Expenses ─────────────────────────────────────────────── */
  const expCount = await prisma.expense.count({ where: { companyId: cid } });
  if (expCount < 10) {
    const expTypes = ["FUEL", "TOLL", "PARKING", "REPAIR", "OTHER"] as const;
    for (let i = 0; i < 30; i++) {
      const type = pick(expTypes);
      const descs = EXPENSE_DESCS[type] ?? ["Cheltuială diversă"];
      await prisma.expense.create({
        data: {
          companyId: cid,
          type,
          amount: randInt(30, 2500),
          currency: opts.currency,
          description: pick(descs),
          occurredAt: daysAgo(randInt(0, 90)),
          truckId: Math.random() > 0.3 ? pick(trucks).id : undefined,
          driverId: Math.random() > 0.3 ? pick(driverProfiles).id : undefined,
          status: pick(["PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED"]),
          reportedById: pick([disp1.id, disp2.id]),
          approvedById: accountant.id,
          approvedAt: daysAgo(randInt(0, 60)),
        },
      });
    }
  }

  /* ── Fuel entries ─────────────────────────────────────────── */
  const fuelCount = await prisma.fuelEntry.count({ where: { companyId: cid } });
  if (fuelCount < 10) {
    for (let i = 0; i < 30; i++) {
      const liters = randInt(150, 700);
      const ppl = randFloat(1.35, 1.75, 3);
      await prisma.fuelEntry.create({
        data: {
          companyId: cid,
          truckId: pick(trucks).id,
          driverId: pick(driverProfiles).id,
          liters,
          pricePerLiter: ppl,
          totalAmount: +(liters * ppl).toFixed(2),
          currency: opts.currency,
          station: pick(STATIONS),
          mileage: randInt(80000, 900000),
          occurredAt: daysAgo(randInt(0, 90)),
        },
      });
    }
  }

  /* ── Maintenance ──────────────────────────────────────────── */
  const maintCount = await prisma.maintenance.count({ where: { companyId: cid } });
  if (maintCount < 5) {
    const maintStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED"] as const;
    const maintTitles = [
      "Revizie 50.000 km", "Revizie anuală", "Schimb plăcuțe frână",
      "Schimb ulei + filtre complete", "Verificare tahograf digital",
      "Reparație sistem de direcție", "Înlocuire anvelope față",
    ];
    for (const truck of trucks) {
      const status = pick(maintStatuses);
      await prisma.maintenance.create({
        data: {
          companyId: cid,
          truckId: truck.id,
          title: pick(maintTitles),
          description: "Intervenție planificată conform grafic service.",
          scheduledAt: daysAgo(randInt(-30, 20)),
          completedAt: status === "COMPLETED" ? daysAgo(randInt(0, 15)) : null,
          cost: randInt(300, 8000),
          currency: opts.currency,
          mileage: randInt(80000, 900000),
          partsReplaced: pick([
            ["filtru ulei", "filtru aer", "filtru combustibil"],
            ["plăcuțe frână față", "discuri frână"],
            ["curea distribuție", "pompă apă"],
            ["ulei motor 10W40", "filtru habitaclu"],
            [],
          ]),
          status,
          notes: Math.random() > 0.5 ? "Verificat conform normelor Euro 6." : null,
        },
      });
    }
  }

  /* ── Notifications ────────────────────────────────────────── */
  const notifCount = await prisma.notification.count({ where: { companyId: cid } });
  if (notifCount < 3) {
    await prisma.notification.createMany({
      data: [
        { userId: disp1.id, companyId: cid, type: "LOAD_UPDATE", title: "Cursă nouă atribuită", body: `${driverProfiles[0].firstName} ${driverProfiles[0].lastName} a acceptat o cursă nouă.`, link: "/dispatch/loads" },
        { userId: disp2.id, companyId: cid, type: "LOAD_UPDATE", title: "Cursă livrată", body: "O cursă a fost marcată ca LIVRATĂ.", link: "/dispatch/loads" },
        { userId: admin.id, companyId: cid, type: "INVOICE_DUE", title: "Facturi scadente", body: "Există facturi scadente în această săptămână.", link: "/accounting/invoices" },
        { userId: accountant.id, companyId: cid, type: "INFO", title: "Cheltuieli de aprobat", body: "Sunt cheltuieli noi în așteptare.", link: "/accounting/expenses" },
        { userId: fleetMgr.id, companyId: cid, type: "DOCUMENT_EXPIRING", title: "Acte camion expiră", body: `Camionul ${trucks[0].plateNumber}: ITP/Asigurare aproape de expirare.`, link: "/fleet/trucks" },
        { userId: disp1.id, companyId: cid, type: "INFO", title: "GPS pierdut", body: `Nu s-au primit date GPS de la ${driverProfiles[1].firstName} de 2 ore.`, link: "/dispatch/map" },
      ],
    });
  }

  /* ── Audit log ────────────────────────────────────────────── */
  const auditCount = await prisma.auditLog.count({ where: { companyId: cid } });
  if (auditCount < 3) {
    await prisma.auditLog.createMany({
      data: [
        { companyId: cid, userId: admin.id, action: "company.update", entityType: "Company", entityId: cid },
        { companyId: cid, userId: disp1.id, action: "load.create", entityType: "Load" },
        { companyId: cid, userId: disp1.id, action: "load.assign", entityType: "Load" },
        { companyId: cid, userId: accountant.id, action: "invoice.create", entityType: "Invoice" },
        { companyId: cid, userId: accountant.id, action: "payment.record", entityType: "Payment" },
        { companyId: cid, userId: fleetMgr.id, action: "truck.update", entityType: "Truck", entityId: trucks[0].id, meta: { field: "status", value: "MAINTENANCE" } as never },
        { companyId: cid, userId: fleetMgr.id, action: "maintenance.create", entityType: "Maintenance" },
      ],
    });
  }

  return { company, driverProfiles, trucks, trailers, customers };
}

/* ─── entry point ─────────────────────────────────────────── */
async function main() {
  console.log("🌱 Starting seed...\n");

  await ensureUser({ email: "admin@tms.local", name: "Super Admin", role: "SUPER_ADMIN", password: "Admin1234!" });

  const c1 = await seedCompany({
    name: "TransLogistic SRL",
    legalName: "TRANSLOGISTIC S.R.L.",
    taxId: "RO12345678",
    adminEmail: "admin@translogistic.local",
    city: "București",
    country: "RO",
    invoicePrefix: "TLG",
    currency: "USD",
  });

  const c2 = await seedCompany({
    name: "EuroFreight Express",
    legalName: "EUROFREIGHT EXPRESS S.R.L.",
    taxId: "RO87654321",
    adminEmail: "admin@eurofreight.local",
    city: "Cluj-Napoca",
    country: "RO",
    invoicePrefix: "EFE",
    currency: "USD",
  });

  const total = {
    drivers:   c1.driverProfiles.length + c2.driverProfiles.length,
    trucks:    c1.trucks.length + c2.trucks.length,
    trailers:  c1.trailers.length + c2.trailers.length,
    customers: c1.customers.length + c2.customers.length,
  };

  console.log("\n✅ Seed complet!");
  console.log("═".repeat(62));
  console.log("  SUPER_ADMIN    → admin@tms.local              / Admin1234!");
  console.log("─".repeat(62));
  console.log("  Compania 1: TransLogistic SRL");
  console.log(`  Admin          → admin@translogistic.local     / ${PASSWORD}`);
  console.log(`  Dispatcher 1   → disp1.tlg@tms.local           / ${PASSWORD}`);
  console.log(`  Dispatcher 2   → disp2.tlg@tms.local           / ${PASSWORD}`);
  console.log(`  Contabil       → contabil.tlg@tms.local         / ${PASSWORD}`);
  console.log(`  Fleet Mgr      → flota.tlg@tms.local            / ${PASSWORD}`);
  console.log(`  Șoferi         → vasile/gheorghe/marian/florin/mihai/alexandru.tlg@tms.local`);
  console.log("─".repeat(62));
  console.log("  Compania 2: EuroFreight Express");
  console.log(`  Admin          → admin@eurofreight.local        / ${PASSWORD}`);
  console.log(`  Dispatcher 1   → disp1.efe@tms.local            / ${PASSWORD}`);
  console.log(`  Șoferi         → vasile/gheorghe/marian/florin/mihai/alexandru.efe@tms.local`);
  console.log("─".repeat(62));
  console.log(`  Total: ${total.drivers} șoferi · ${total.trucks} camioane · ${total.trailers} remorci · ${total.customers} clienți`);
  console.log(`         ~40 curse · ~18 facturi · ~30 cheltuieli · ~30 alimentări (per companie)`);
  console.log("═".repeat(62));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
