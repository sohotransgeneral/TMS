/**
 * Seed script — populates the TMS with realistic demo data.
 * Run: node scripts/seed.mjs
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────────
const hash = (p) => bcrypt.hash(p, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  console.log("🌱  Seeding TMS database...\n");

  // ── 1. Company ──────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: "000000000000000000000001" },
    update: {},
    create: {
      id: "000000000000000000000001",
      name: "SohoTrans SRL",
      legalName: "SohoTrans International SRL",
      taxId: "RO12345678",
      registrationNumber: "J40/1234/2020",
      email: "office@sohotrans.ro",
      phone: "+40721000001",
      website: "https://sohotrans.ro",
      street: "Strada Transportului 12",
      city: "București",
      county: "Ilfov",
      postalCode: "010000",
      country: "RO",
      bankName: "Banca Transilvania",
      bankAccount: "RO49AAAA1B31007593840000",
      currency: "EUR",
      vatRate: 19,
      invoicePrefix: "STR",
      invoiceCounter: 10,
      subscriptionStatus: "ACTIVE",
      subscriptionPlan: "professional",
      active: true,
    },
  });
  console.log("✅  Company:", company.name);

  // ── 2. Users ────────────────────────────────────────────────────────────────
  const pw = await hash("Admin123!@#");

  const superAdmin = await prisma.user.upsert({
    where: { email: "racustefan34@gmail.com" },
    update: {},
    create: {
      email: "racustefan34@gmail.com",
      password: pw,
      name: "Stefan Racu",
      role: "SUPER_ADMIN",
      active: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@sohotrans.ro" },
    update: {},
    create: {
      email: "admin@sohotrans.ro",
      password: pw,
      name: "Maria Ionescu",
      role: "COMPANY_ADMIN",
      companyId: company.id,
      active: true,
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { email: "dispatcher@sohotrans.ro" },
    update: {},
    create: {
      email: "dispatcher@sohotrans.ro",
      password: pw,
      name: "Andrei Popescu",
      role: "DISPATCHER",
      companyId: company.id,
      active: true,
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "accountant@sohotrans.ro" },
    update: {},
    create: {
      email: "accountant@sohotrans.ro",
      password: pw,
      name: "Elena Dumitrescu",
      role: "ACCOUNTANT",
      companyId: company.id,
      active: true,
    },
  });

  // ── 3. Driver users + profiles ──────────────────────────────────────────────
  const driverData = [
    { firstName: "Ion",      lastName: "Moldovan",   email: "ion.moldovan@sohotrans.ro",   plate: "B-01-SOH", status: "ON_TRIP" },
    { firstName: "Gheorghe", lastName: "Stanciu",    email: "ghe.stanciu@sohotrans.ro",    plate: "B-02-SOH", status: "AVAILABLE" },
    { firstName: "Vasile",   lastName: "Constantin", email: "vas.constantin@sohotrans.ro", plate: "B-03-SOH", status: "AVAILABLE" },
    { firstName: "Nicolae",  lastName: "Petrescu",   email: "nic.petrescu@sohotrans.ro",   plate: "B-04-SOH", status: "OFF_DUTY" },
    { firstName: "Mihai",    lastName: "Rusu",       email: "mih.rusu@sohotrans.ro",       plate: "B-05-SOH", status: "AVAILABLE" },
  ];

  const driverUsers = [];
  const driverProfiles = [];

  for (const d of driverData) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        password: pw,
        name: `${d.firstName} ${d.lastName}`,
        role: "DRIVER",
        companyId: company.id,
        active: true,
      },
    });
    driverUsers.push(u);

    const existing = await prisma.driverProfile.findUnique({ where: { userId: u.id } });
    let profile;
    if (existing) {
      profile = existing;
    } else {
      profile = await prisma.driverProfile.create({
        data: {
          companyId: company.id,
          userId: u.id,
          firstName: d.firstName,
          lastName: d.lastName,
          licenseNumber: `B${randNum(100000, 999999)}`,
          licenseCategories: ["B", "C", "CE"],
          licenseExpiresAt: daysFromNow(randNum(200, 900)),
          tachoCardNumber: `ROT${randNum(1000000, 9999999)}`,
          tachoCardExpiresAt: daysFromNow(randNum(100, 500)),
          employedSince: daysAgo(randNum(200, 1500)),
          salaryPerKm: 0.15,
          status: d.status,
        },
      });
    }
    driverProfiles.push(profile);
  }
  console.log(`✅  ${driverProfiles.length} drivers`);

  // ── 4. Trucks ───────────────────────────────────────────────────────────────
  const truckData = [
    { plateNumber: "B-01-SOH", make: "Volvo",   model: "FH 500", year: 2021, status: "ON_TRIP" },
    { plateNumber: "B-02-SOH", make: "Scania",  model: "R 450",  year: 2020, status: "AVAILABLE" },
    { plateNumber: "B-03-SOH", make: "DAF",     model: "XF 480", year: 2022, status: "AVAILABLE" },
    { plateNumber: "B-04-SOH", make: "MAN",     model: "TGX 18", year: 2019, status: "IN_SERVICE" },
    { plateNumber: "B-05-SOH", make: "Mercedes",model: "Actros", year: 2023, status: "AVAILABLE" },
  ];

  const trucks = [];
  for (const t of truckData) {
    const existing = await prisma.truck.findFirst({ where: { plateNumber: t.plateNumber, companyId: company.id } });
    if (existing) { trucks.push(existing); continue; }
    const truck = await prisma.truck.create({
      data: {
        companyId: company.id,
        plateNumber: t.plateNumber,
        make: t.make,
        model: t.model,
        year: t.year,
        vin: `WF0XXXGBX${randNum(10000000, 99999999)}`,
        status: t.status,
        mileage: randNum(80000, 400000),
        insuranceExpiresAt: daysFromNow(randNum(30, 365)),
        itpExpiresAt: daysFromNow(randNum(60, 400)),
        vignetteExpiresAt: daysFromNow(randNum(10, 300)),
      },
    });
    trucks.push(truck);
  }
  console.log(`✅  ${trucks.length} trucks`);

  // ── 5. Trailers ─────────────────────────────────────────────────────────────
  const trailerData = [
    { plateNumber: "BR-01-SOH", type: "Curtainsider" },
    { plateNumber: "BR-02-SOH", type: "Refrigerated" },
    { plateNumber: "BR-03-SOH", type: "Flatbed" },
  ];
  const trailers = [];
  for (const t of trailerData) {
    const existing = await prisma.trailer.findFirst({ where: { plateNumber: t.plateNumber, companyId: company.id } });
    if (existing) { trailers.push(existing); continue; }
    const trailer = await prisma.trailer.create({
      data: {
        companyId: company.id,
        plateNumber: t.plateNumber,
        type: t.type,
        capacityKg: 24000,
        volumeM3: 90,
        status: "AVAILABLE",
        insuranceExpiresAt: daysFromNow(randNum(60, 365)),
        itpExpiresAt: daysFromNow(randNum(60, 400)),
      },
    });
    trailers.push(trailer);
  }
  console.log(`✅  ${trailers.length} trailers`);

  // ── 6. Customers ────────────────────────────────────────────────────────────
  const customerData = [
    { name: "Dedeman SA",        email: "logistica@dedeman.ro",      city: "Bacău",      country: "RO" },
    { name: "Kaufland Romania",  email: "transport@kaufland.ro",     city: "București",  country: "RO" },
    { name: "Metro AG",          email: "freight@metro.de",          city: "Düsseldorf", country: "DE" },
    { name: "Lidl Logistics",    email: "logistics@lidl.ro",         city: "Cluj-Napoca",country: "RO" },
    { name: "Amazon EU Sarl",    email: "carriers@amazon.lu",        city: "Luxembourg", country: "LU" },
    { name: "DB Schenker",       email: "booking@dbschenker.com",    city: "Frankfurt",  country: "DE" },
  ];
  const customers = [];
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({ where: { companyId: company.id, name: c.name } });
    if (existing) { customers.push(existing); continue; }
    const cust = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: c.name,
        email: c.email,
        city: c.city,
        country: c.country,
        paymentTermsDays: rand([14, 30, 45, 60]),
      },
    });
    customers.push(cust);
  }
  console.log(`✅  ${customers.length} customers`);

  // ── 7. Loads ─────────────────────────────────────────────────────────────────
  const routes = [
    { from: "București",  fromCity: "București",  fromAddr: "Str. Industriilor 5, București", to: "Cluj-Napoca", toCity: "Cluj-Napoca", toAddr: "Calea Turzii 100, Cluj-Napoca", km: 450 },
    { from: "București",  fromCity: "București",  fromAddr: "Șos. Alexandriei 22, București", to: "Timișoara",   toCity: "Timișoara",   toAddr: "Calea Aradului 44, Timișoara",   km: 570 },
    { from: "Cluj-Napoca",fromCity: "Cluj-Napoca",fromAddr: "Str. Avram Iancu 3, Cluj",       to: "Berlin",      toCity: "Berlin",      toAddr: "Frankfurter Allee 10, Berlin",   km: 1650 },
    { from: "Timișoara",  fromCity: "Timișoara",  fromAddr: "Str. Fabricii 8, Timișoara",     to: "München",     toCity: "München",     toAddr: "Münchner Str. 30, München",      km: 1200 },
    { from: "Iași",       fromCity: "Iași",       fromAddr: "Str. Moara de Vânt 11, Iași",    to: "București",   toCity: "București",   toAddr: "Bd. Unirii 50, București",       km: 380 },
    { from: "Constanța",  fromCity: "Constanța",  fromAddr: "Str. Portului 1, Constanța",     to: "Wien",        toCity: "Wien",        toAddr: "Laxenburger Str. 5, Wien",       km: 1350 },
    { from: "București",  fromCity: "București",  fromAddr: "Str. Metalurgiei 7, București",  to: "Varșovia",    toCity: "Varșovia",    toAddr: "ul. Prosta 10, Warszawa",        km: 1100 },
  ];

  const loadDefs = [
    // Completed loads
    { route: 0, statusIdx: 10, driverIdx: 0, truckIdx: 0, daysAgoStart: 10, price: 1800, currency: "EUR", customer: 0 },
    { route: 1, statusIdx: 11, driverIdx: 1, truckIdx: 1, daysAgoStart: 15, price: 2200, currency: "EUR", customer: 1 },
    { route: 4, statusIdx: 9,  driverIdx: 2, truckIdx: 2, daysAgoStart: 5,  price: 1200, currency: "EUR", customer: 3 },
    // In-transit
    { route: 2, statusIdx: 6,  driverIdx: 0, truckIdx: 0, daysAgoStart: 2,  price: 3800, currency: "EUR", customer: 4 },
    { route: 3, statusIdx: 5,  driverIdx: 1, truckIdx: 1, daysAgoStart: 1,  price: 2900, currency: "EUR", customer: 2 },
    { route: 6, statusIdx: 7,  driverIdx: 4, truckIdx: 4, daysAgoStart: 3,  price: 2600, currency: "EUR", customer: 5 },
    // Assigned / accepted
    { route: 5, statusIdx: 2,  driverIdx: 2, truckIdx: 2, daysAgoStart: -1, price: 3100, currency: "EUR", customer: 0 },
    { route: 0, statusIdx: 1,  driverIdx: 3, truckIdx: 3, daysAgoStart: -2, price: 1600, currency: "EUR", customer: 1 },
    // Drafts
    { route: 1, statusIdx: 0,  driverIdx: null, truckIdx: null, daysAgoStart: -3, price: 2400, currency: "EUR", customer: 3 },
    { route: 4, statusIdx: 0,  driverIdx: null, truckIdx: null, daysAgoStart: -4, price: 1100, currency: "EUR", customer: 2 },
    { route: 6, statusIdx: 0,  driverIdx: null, truckIdx: null, daysAgoStart: -5, price: 2700, currency: "EUR", customer: 4 },
    // Invoiced
    { route: 3, statusIdx: 10, driverIdx: 4, truckIdx: 4, daysAgoStart: 20, price: 2200, currency: "EUR", customer: 5 },
    { route: 2, statusIdx: 11, driverIdx: 2, truckIdx: 2, daysAgoStart: 30, price: 4100, currency: "EUR", customer: 0 },
  ];

  const STATUSES = [
    "DRAFT","ASSIGNED","DRIVER_ACCEPTED","ON_WAY_TO_PICKUP",
    "AT_PICKUP","LOADED","IN_TRANSIT","AT_DELIVERY",
    "DELIVERED","POD_UPLOADED","INVOICED","PAID",
  ];

  const loads = [];
  let refCounter = 1;
  for (const def of loadDefs) {
    const r = routes[def.route];
    const status = STATUSES[def.statusIdx];
    const pickupDate = new Date(Date.now() - def.daysAgoStart * 86_400_000);
    const deliveryDate = new Date(pickupDate.getTime() + (r.km / 80) * 3_600_000);

    const load = await prisma.load.create({
      data: {
        companyId: company.id,
        referenceNumber: `STR-2026-${String(refCounter++).padStart(4, "0")}`,
        status,
        pickupAddress: r.fromAddr,
        pickupCity: r.fromCity,
        pickupCountry: r.fromCity === "Berlin" || r.fromCity === "München" ? "DE" : r.fromCity === "Wien" ? "AT" : r.fromCity === "Varșovia" ? "PL" : "RO",
        pickupDate,
        deliveryAddress: r.toAddr,
        deliveryCity: r.toCity,
        deliveryCountry: ["Berlin","München"].includes(r.toCity) ? "DE" : r.toCity === "Wien" ? "AT" : r.toCity === "Varșovia" ? "PL" : "RO",
        deliveryDate,
        price: def.price,
        currency: def.currency,
        estimatedDistanceKm: r.km,
        cargoDescription: rand(["General cargo", "Electronics", "Food products", "Building materials", "Furniture", "Auto parts"]),
        weightKg: randNum(5000, 22000),
        customerId: customers[def.customer].id,
        driverId: def.driverIdx !== null ? driverProfiles[def.driverIdx].id : null,
        truckId: def.truckIdx !== null ? trucks[def.truckIdx].id : null,
        trailerId: rand(trailers).id,
        createdById: dispatcher.id,
        dispatcherId: dispatcher.id,
      },
    });
    loads.push(load);
  }
  console.log(`✅  ${loads.length} loads (${loads.filter(l=>l.status==="DRAFT").length} draft, ${loads.filter(l=>["ASSIGNED","DRIVER_ACCEPTED"].includes(l.status)).length} assigned, ${loads.filter(l=>["LOADED","IN_TRANSIT","AT_DELIVERY"].includes(l.status)).length} in transit)`);

  // ── 8. Invoices ─────────────────────────────────────────────────────────────
  const invoicedLoads = loads.filter((l) => ["INVOICED", "PAID"].includes(l.status));
  let invCounter = 11;
  const invoices = [];
  for (const l of invoicedLoads) {
    const inv = await prisma.invoice.create({
      data: {
        companyId: company.id,
        number: `STR-${invCounter++}`,
        customerId: l.customerId,
        loadId: l.id,
        status: l.status === "PAID" ? "PAID" : "SENT",
        issueDate: daysAgo(l.status === "PAID" ? 20 : 5),
        dueDate: daysFromNow(l.status === "PAID" ? -10 : 25),
        currency: l.currency,
        subtotal: l.price,
        vatRate: 0,
        vatAmount: 0,
        total: l.price,
        notes: "Payment via bank transfer. IBAN: RO49AAAA1B31007593840000",
      },
    });
    invoices.push(inv);
  }
  console.log(`✅  ${invoices.length} invoices`);

  // ── 9. Expenses ─────────────────────────────────────────────────────────────
  const expenseTypes = ["FUEL","TOLL","PARKING","REPAIR","FUEL","FUEL","TOLL"];
  for (let i = 0; i < 15; i++) {
    const type = rand(expenseTypes);
    await prisma.expense.create({
      data: {
        companyId: company.id,
        type,
        amount: randNum(50, 1200),
        currency: "EUR",
        occurredAt: daysAgo(randNum(1, 60)),
        description: type === "FUEL" ? `Refueling — ${randNum(200,600)}L` : type === "TOLL" ? "Motorway toll" : type === "REPAIR" ? "Service & repair" : "Parking fee",
        status: rand(["PENDING","APPROVED","APPROVED","APPROVED"]),
        truckId: rand(trucks).id,
        reportedById: rand(driverUsers).id,
      },
    });
  }
  console.log("✅  15 expenses");

  // ── 10. Fuel entries ────────────────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const truck = rand(trucks);
    await prisma.fuelEntry.create({
      data: {
        companyId: company.id,
        truckId: truck.id,
        driverId: rand(driverProfiles).id,
        liters: randNum(200, 600),
        pricePerLiter: parseFloat((rand(["1.65","1.72","1.58","1.80"]))),
        totalAmount: 0, // will compute below
        mileage: randNum(100000, 400000),
        station: rand(["OMV", "Petrom", "Rompetrol", "MOL", "Shell"]),
        currency: "EUR",
      },
    }).then(async (entry) => {
      await prisma.fuelEntry.update({
        where: { id: entry.id },
        data: { totalAmount: parseFloat((entry.liters * entry.pricePerLiter).toFixed(2)) },
      });
    });
  }
  console.log("✅  10 fuel entries");

  // ── 11. Maintenances ────────────────────────────────────────────────────────
  for (const truck of trucks.slice(0, 3)) {
    await prisma.maintenance.create({
      data: {
        companyId: company.id,
        truckId: truck.id,
        title: rand(["Oil change", "Brake inspection", "Tire rotation", "Annual service"]),
        description: "Scheduled maintenance as per manufacturer guidelines",
        status: rand(["SCHEDULED","COMPLETED","COMPLETED"]),
        scheduledAt: rand([daysAgo(5), daysFromNow(10), daysFromNow(20)]),
        cost: randNum(200, 1500),
        currency: "EUR",
      },
    });
  }
  console.log("✅  3 maintenances");

  // ── 12. GPS locations (simulate driver positions) ───────────────────────────
  const positions = [
    { lat: 44.4268, lng: 26.1025 }, // București
    { lat: 46.7712, lng: 23.6236 }, // Cluj-Napoca
    { lat: 45.7489, lng: 21.2087 }, // Timișoara
    { lat: 47.1585, lng: 27.6014 }, // Iași
    { lat: 44.1598, lng: 28.6348 }, // Constanța
  ];
  for (let i = 0; i < driverProfiles.length; i++) {
    const pos = positions[i];
    await prisma.gPSLocation.create({
      data: {
        companyId: company.id,
        driverId: driverProfiles[i].id,
        lat: pos.lat + (Math.random() - 0.5) * 0.1,
        lng: pos.lng + (Math.random() - 0.5) * 0.1,
        speed: randNum(0, 90),
        heading: randNum(0, 360),
        accuracy: randNum(5, 20),
        recordedAt: new Date(),
      },
    }).catch(() => {});
  }
  console.log("✅  GPS positions for all drivers");

  console.log("\n🎉  Seed complete!\n");
  console.log("📋  Login accounts (all password: Admin123!@#):");
  console.log("    SUPER_ADMIN  → racustefan34@gmail.com");
  console.log("    COMPANY_ADMIN→ admin@sohotrans.ro");
  console.log("    DISPATCHER   → dispatcher@sohotrans.ro");
  console.log("    ACCOUNTANT   → accountant@sohotrans.ro");
  console.log("    DRIVER       → ion.moldovan@sohotrans.ro");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
