/**
 * reset-us-seed.mjs
 * Clears ALL data except the super admin account (racustefan34@gmail.com),
 * then seeds with realistic US trucking data.
 * Run: node scripts/reset-us-seed.mjs
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Demo1234!";
const SUPER_ADMIN_EMAIL = "racustefan34@gmail.com";

// ── helpers ────────────────────────────────────────────────────────────────────
const hash = (p) => bcrypt.hash(p, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n, base = new Date()) => new Date(base.getTime() + n * 86_400_000);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, dp = 2) => +((Math.random() * (max - min) + min).toFixed(dp));

// ── US Reference Data ──────────────────────────────────────────────────────────

const US_ROUTES = [
  { from: ["Chicago, IL",      41.8781, -87.6298], to: ["Detroit, MI",     42.3314, -83.0458], distMi: 280 },
  { from: ["Dallas, TX",       32.7767, -96.7970], to: ["Houston, TX",     29.7604, -95.3698], distMi: 240 },
  { from: ["Los Angeles, CA",  34.0522,-118.2437], to: ["Phoenix, AZ",     33.4484,-112.0740], distMi: 372 },
  { from: ["Atlanta, GA",      33.7490, -84.3880], to: ["Nashville, TN",   36.1627, -86.7816], distMi: 250 },
  { from: ["Memphis, TN",      35.1495, -90.0490], to: ["St. Louis, MO",   38.6270, -90.1994], distMi: 285 },
  { from: ["Kansas City, MO",  39.0997, -94.5786], to: ["Denver, CO",      39.7392,-104.9903], distMi: 600 },
  { from: ["Philadelphia, PA", 39.9526, -75.1652], to: ["Charlotte, NC",   35.2271, -80.8431], distMi: 480 },
  { from: ["Seattle, WA",      47.6062,-122.3321], to: ["Portland, OR",    45.5051,-122.6750], distMi: 175 },
  { from: ["Miami, FL",        25.7617, -80.1918], to: ["Jacksonville, FL",30.3322, -81.6557], distMi: 340 },
  { from: ["Minneapolis, MN",  44.9778, -93.2650], to: ["Chicago, IL",     41.8781, -87.6298], distMi: 410 },
  { from: ["San Antonio, TX",  29.4241, -98.4936], to: ["El Paso, TX",     31.7619,-106.4850], distMi: 550 },
  { from: ["Columbus, OH",     39.9612, -82.9988], to: ["Pittsburgh, PA",  40.4406, -79.9959], distMi: 185 },
];

const US_CARGO = [
  "General Freight",
  "Refrigerated Goods",
  "Building Materials",
  "Automotive Parts",
  "Consumer Electronics",
  "Household Appliances",
  "Industrial Equipment",
  "Packaged Foods",
  "Clothing & Textiles",
  "Pharmaceutical Products",
  "Agricultural Produce",
  "Steel & Metal Products",
];

const US_TRUCK_MAKES = [
  { make: "Freightliner", models: ["Cascadia 126", "Cascadia 116", "M2 106"] },
  { make: "Kenworth",     models: ["T680", "T880", "W990"] },
  { make: "Peterbilt",    models: ["579", "389", "567"] },
  { make: "International",models: ["LT Series", "HX Series", "MV Series"] },
  { make: "Mack",         models: ["Anthem", "Pinnacle", "Granite"] },
  { make: "Volvo",        models: ["VNL 860", "VNL 760", "VNL 670"] },
];

const US_FUEL_STATIONS = [
  "Pilot Flying J — I-80 Chicago", "Love's Travel Stop — Dallas", "TA Travel Center — Atlanta",
  "Petro Stopping Center — Memphis", "Flying J — Kansas City", "Pilot — Los Angeles",
  "Love's — Nashville", "TA — Philadelphia", "Pilot — Seattle", "Flying J — Miami",
  "Petro — Columbus", "Love's — San Antonio",
];

const US_EXPENSE_DESCS = {
  FUEL:    ["DEF fluid top-off", "Fuel additive treatment"],
  TOLL:    ["I-90 Toll — Chicago", "NJ Turnpike", "Pennsylvania Turnpike", "I-476 Blue Route", "Ohio Turnpike"],
  PARKING: ["Truck stop overnight — Memphis", "Secured lot — Atlanta", "Terminal parking — Dallas"],
  REPAIR:  ["Front tire replacement", "Brake shoe replacement", "Alternator replacement", "Belt & hose inspection", "ABS sensor repair"],
  OTHER:   ["Truck wash — Pilot", "Scale ticket", "Driver motel — Nashville", "DOT compliance check", "50k mile service"],
};

// ── CLEAR ALL DATA ─────────────────────────────────────────────────────────────
async function clearAll() {
  console.log("🗑️  Clearing all existing data (preserving super admin)...");
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.mapZonePin.deleteMany({});
  await prisma.gPSLocation.deleteMany({});
  await prisma.fuelEntry.deleteMany({});
  await prisma.maintenance.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.loadStatusHistory.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.load.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.driverProfile.deleteMany({});
  await prisma.trailer.deleteMany({});
  await prisma.truck.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: SUPER_ADMIN_EMAIL } } });
  await prisma.company.deleteMany({});
  console.log("✅  Cleared.\n");
}

// ── SEED ──────────────────────────────────────────────────────────────────────
async function seedCompany(opts) {
  const pw = await hash(PASSWORD);

  // Company
  const company = await prisma.company.create({
    data: {
      name: opts.name,
      legalName: opts.legalName,
      taxId: opts.taxId,
      registrationNumber: `US-DOT-${randInt(1000000, 9999999)}`,
      email: `office@${opts.name.toLowerCase().replace(/[\s.&]+/g, "")}.com`,
      phone: `+1-${randInt(200,999)}-${randInt(200,999)}-${randInt(1000,9999)}`,
      website: `https://www.${opts.name.toLowerCase().replace(/[\s.&]+/g, "")}.com`,
      street: `${randInt(100, 9999)} ${rand(["Commerce Dr", "Industrial Blvd", "Transport Way", "Logistics Ave", "Freight Pkwy"])}`,
      city: opts.city,
      county: opts.state,
      postalCode: opts.zip,
      country: "US",
      bankName: rand(["Wells Fargo", "Bank of America", "JPMorgan Chase", "Truist Bank", "US Bank"]),
      bankAccount: `US${randInt(10, 99)}${randInt(1000000000, 9999999999)}`,
      currency: "USD",
      vatRate: 0,
      invoicePrefix: opts.invoicePrefix,
      invoiceCounter: 0,
      subscriptionStatus: "ACTIVE",
      subscriptionPlan: "pro",
      active: true,
    },
  });
  const cid = company.id;
  console.log(`  ✅ Company: ${company.name} (${cid})`);

  // Staff
  const adminUser = await prisma.user.create({ data: { email: opts.adminEmail, name: opts.adminName, role: "COMPANY_ADMIN", companyId: cid, password: pw, active: true } });
  const disp1 = await prisma.user.create({ data: { email: `dispatch1@${opts.emailDomain}`, name: rand(["Mike Johnson", "Tyler Brooks", "Chris Evans"]), role: "DISPATCHER", companyId: cid, password: pw, active: true, phone: `+1-${randInt(200,999)}-555-0101` } });
  const disp2 = await prisma.user.create({ data: { email: `dispatch2@${opts.emailDomain}`, name: rand(["Sarah Williams", "Ashley Carter", "Lauren Davis"]), role: "DISPATCHER", companyId: cid, password: pw, active: true, phone: `+1-${randInt(200,999)}-555-0102` } });
  const accountant = await prisma.user.create({ data: { email: `accounting@${opts.emailDomain}`, name: rand(["Jennifer Smith", "Patricia Lee", "Nancy Clark"]), role: "ACCOUNTANT", companyId: cid, password: pw, active: true } });
  const fleetMgr = await prisma.user.create({ data: { email: `fleet@${opts.emailDomain}`, name: rand(["Robert Martinez", "Kevin Anderson", "Brian Thompson"]), role: "FLEET_MANAGER", companyId: cid, password: pw, active: true } });

  // Drivers
  const driverDefs = [
    { first: "James",   last: "Mitchell",  phone: "+1-512-555-0201", km: 0.55 },
    { first: "William", last: "Harris",    phone: "+1-214-555-0202", km: 0.52 },
    { first: "David",   last: "Robinson",  phone: "+1-404-555-0203", km: 0.58 },
    { first: "Michael", last: "Walker",    phone: "+1-312-555-0204", km: 0.50 },
    { first: "Thomas",  last: "Hall",      phone: "+1-713-555-0205", km: 0.54 },
    { first: "Charles", last: "Young",     phone: "+1-615-555-0206", km: 0.53 },
  ];

  const driverProfiles = [];
  for (const d of driverDefs) {
    const email = `${d.first.toLowerCase()}.${d.last.toLowerCase()}@${opts.emailDomain}`;
    const user = await prisma.user.create({
      data: { email, name: `${d.first} ${d.last}`, role: "DRIVER", companyId: cid, password: pw, active: true, phone: d.phone },
    });
    const profile = await prisma.driverProfile.create({
      data: {
        companyId: cid,
        userId: user.id,
        firstName: d.first,
        lastName: d.last,
        licenseNumber: `CDL-${randInt(1000000, 9999999)}`,
        licenseCategories: ["A", "B"],
        licenseIssuedAt: daysAgo(randInt(1000, 5000)),
        licenseExpiresAt: daysFromNow(randInt(180, 1500)),
        tachoCardNumber: `ELD-${randInt(10000000, 99999999)}`,
        tachoCardExpiresAt: daysFromNow(randInt(60, 900)),
        employedSince: daysAgo(randInt(180, 2500)),
        salaryPerKm: d.km,
        commissionRate: 5,
        rating: randFloat(3.8, 5.0, 1),
        status: rand(["AVAILABLE", "AVAILABLE", "ON_TRIP", "ON_TRIP", "OFF_DUTY"]),
        internalNotes: Math.random() > 0.7 ? "Prefers overnight hauls." : null,
      },
    });
    driverProfiles.push({ id: profile.id, firstName: d.first, lastName: d.last });
  }
  console.log(`  ✅ ${driverProfiles.length} drivers`);

  // Trucks
  const trucks = [];
  const statePlates = ["TX", "IL", "CA", "GA", "TN", "OH"];
  for (let i = 0; i < 6; i++) {
    const brand = rand(US_TRUCK_MAKES);
    const plateNum = `${statePlates[i]}-${opts.invoicePrefix}${String(i + 1).padStart(2, "0")}`;
    const truck = await prisma.truck.create({
      data: {
        companyId: cid,
        plateNumber: plateNum,
        vin: `1FUJG${randInt(10000000, 99999999)}${randInt(10, 99)}`,
        make: brand.make,
        model: rand(brand.models),
        year: randInt(2018, 2024),
        color: rand(["White", "Black", "Silver", "Blue", "Red"]),
        mileage: randInt(80000, 900000),
        fuelType: "diesel",
        avgConsumption: randFloat(6.0, 8.5, 1), // mpg for US trucks
        insuranceExpiresAt: daysFromNow(randInt(-10, 400)),
        itpExpiresAt: daysFromNow(randInt(-5, 400)),
        vignetteExpiresAt: daysFromNow(randInt(10, 365)),
        tachographExpiresAt: daysFromNow(randInt(30, 700)),
        status: rand(["AVAILABLE", "AVAILABLE", "ON_TRIP", "ON_TRIP", "IN_SERVICE"]),
      },
    });
    trucks.push(truck);
  }
  console.log(`  ✅ ${trucks.length} trucks`);

  // Trailers
  const trailerTypes = ["tilt", "reefer", "flatbed", "tanker"];
  const trailers = [];
  for (let i = 0; i < 4; i++) {
    const trailer = await prisma.trailer.create({
      data: {
        companyId: cid,
        plateNumber: `TR-${opts.invoicePrefix}-${String(i + 1).padStart(2, "0")}`,
        type: trailerTypes[i % trailerTypes.length],
        capacityKg: rand([20000, 22000, 24000]),
        volumeM3: rand([80, 85, 90]),
        axles: 2,
        yearOfManufacture: randInt(2016, 2023),
        insuranceExpiresAt: daysFromNow(randInt(20, 400)),
        itpExpiresAt: daysFromNow(randInt(20, 400)),
        status: rand(["AVAILABLE", "AVAILABLE", "ON_TRIP"]),
      },
    });
    trailers.push(trailer);
  }
  console.log(`  ✅ ${trailers.length} trailers`);

  // Customers
  const customerDefs = [
    { name: "Amazon Logistics",        taxId: "91-1646860", city: "Seattle, WA",     payDays: 30 },
    { name: "Walmart Supply Chain",    taxId: "71-0415188", city: "Bentonville, AR", payDays: 45 },
    { name: "Home Depot Distribution", taxId: "58-0634355", city: "Atlanta, GA",     payDays: 30 },
    { name: "Target Corporation",      taxId: "41-0215170", city: "Minneapolis, MN", payDays: 30 },
    { name: "Costco Wholesale",        taxId: "91-1223280", city: "Issaquah, WA",    payDays: 60 },
    { name: "AutoZone Freight",        taxId: "62-1482048", city: "Memphis, TN",     payDays: 30 },
    { name: "Menards Supply",          taxId: "39-0843534", city: "Eau Claire, WI",  payDays: 45 },
    { name: "Sysco Foods",             taxId: "74-1648137", city: "Houston, TX",     payDays: 30 },
  ];

  const customers = [];
  for (const c of customerDefs) {
    const cust = await prisma.customer.create({
      data: {
        companyId: cid,
        name: c.name,
        contactPerson: "Freight & Logistics Dept.",
        email: `freight@${c.name.split(" ")[0].toLowerCase()}.com`,
        phone: `+1-${randInt(200, 999)}-${randInt(200, 999)}-${randInt(1000, 9999)}`,
        taxId: c.taxId,
        registrationNumber: `EIN-${randInt(10, 99)}-${randInt(1000000, 9999999)}`,
        street: `${randInt(100, 9999)} ${rand(["Commerce Blvd", "Industrial Way", "Distribution Dr", "Freight Ave"])}`,
        city: c.city,
        county: c.city.split(", ")[1] ?? c.city,
        country: "US",
        paymentTermsDays: c.payDays,
        creditLimit: randInt(50000, 500000),
      },
    });
    customers.push(cust);
  }
  console.log(`  ✅ ${customers.length} customers`);

  // Loads
  const statusPool = [
    "DRAFT", "ASSIGNED", "ASSIGNED",
    "IN_TRANSIT", "IN_TRANSIT", "IN_TRANSIT",
    "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
    "INVOICED", "INVOICED", "INVOICED",
    "PAID", "PAID",
    "CANCELLED",
  ];

  const loadIdsForInvoice = [];
  for (let i = 0; i < 40; i++) {
    const route = rand(US_ROUTES);
    const agoDays = randInt(0, 85);
    const pickupDate = daysAgo(agoDays);
    const status = rand(statusPool);
    const driver = rand(driverProfiles);
    const truck = rand(trucks);
    const trailer = rand(trailers);
    const customer = rand(customers);
    const price = Math.round(route.distMi * randFloat(3.5, 6.5, 2)); // $/mile

    const refNum = `L-2026-${String(i + 1).padStart(4, "0")}-${opts.invoicePrefix}`;

    const load = await prisma.load.create({
      data: {
        companyId: cid,
        referenceNumber: refNum,
        customerId: customer.id,
        pickupAddress: `${randInt(100, 9999)} Warehouse Dr, ${route.from[0]}`,
        pickupCity: route.from[0],
        pickupCountry: "US",
        pickupLat: route.from[1] + (Math.random() - 0.5) * 0.05,
        pickupLng: route.from[2] + (Math.random() - 0.5) * 0.05,
        pickupDate,
        deliveryAddress: `${randInt(100, 9999)} Distribution Blvd, ${route.to[0]}`,
        deliveryCity: route.to[0],
        deliveryCountry: "US",
        deliveryLat: route.to[1] + (Math.random() - 0.5) * 0.05,
        deliveryLng: route.to[2] + (Math.random() - 0.5) * 0.05,
        deliveryDate: daysFromNow(randInt(1, 3), pickupDate),
        cargoDescription: rand(US_CARGO),
        weightKg: randInt(8000, 20000),
        volumeM3: randInt(30, 85),
        packages: randInt(10, 400),
        price,
        currency: "USD",
        estimatedDistanceKm: Math.round(route.distMi * 1.60934),
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
      const flow = ["ASSIGNED", "IN_TRANSIT", "DELIVERED", "INVOICED", "PAID"];
      for (const s of flow) {
        await prisma.loadStatusHistory.create({
          data: {
            loadId: load.id,
            status: s,
            changedById: disp1.id,
            note: `Status updated to ${s}`,
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
            speed: randInt(55, 75),
            heading: randInt(0, 359),
            recordedAt: new Date(pickupDate.getTime() + g * 3_600_000 * (route.distMi / 55)),
          },
        });
      }
    }

    if (["DELIVERED", "INVOICED", "PAID"].includes(status)) {
      loadIdsForInvoice.push(load.id);
    }
  }
  console.log(`  ✅ 40 loads`);

  // Invoices
  const invoiceStatuses = [
    "DRAFT", "SENT", "SENT", "SENT",
    "PAID", "PAID", "PAID", "PAID",
    "OVERDUE", "OVERDUE", "OVERDUE",
  ];

  const uniqueLoadIds = [...new Set(loadIdsForInvoice)].slice(0, 12);
  const invoiceTargets = [
    ...uniqueLoadIds.map((id) => ({ loadId: id, customerId: null })),
    ...Array.from({ length: 6 }, () => ({ loadId: null, customerId: rand(customers).id })),
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
    const invStatus = rand(invoiceStatuses);

    let customerId = target.customerId;
    let subtotal = randInt(1200, 18000);
    let pickupCity = null;
    let deliveryCity = null;

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

    // US: no VAT for freight (use 0%)
    const total = subtotal;
    const isPaid = invStatus === "PAID";
    const paidAmount = isPaid ? total : 0;
    const issueDate = daysAgo(randInt(0, 60));
    const dueDate = daysFromNow(randInt(-15, 45), issueDate);

    const lineItems = [
      {
        description: pickupCity && deliveryCity
          ? `Freight Transport: ${pickupCity} → ${deliveryCity}`
          : `Freight Services — ${issueDate.toLocaleString("en-US", { month: "long", year: "numeric" })}`,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal,
      },
    ];
    if (Math.random() > 0.5) {
      const fuel = randInt(80, 400);
      lineItems.push({ description: "Fuel Surcharge", quantity: 1, unitPrice: fuel, total: fuel });
    }

    try {
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
          vatRate: 0,
          vatAmount: 0,
          total,
          currency: "USD",
          paidAmount,
          status: invStatus,
          notes: Math.random() > 0.6 ? "Please remit payment within terms. Thank you for your business." : null,
          items: lineItems,
        },
      });

      if (isPaid) {
        await prisma.payment.create({
          data: {
            companyId: cid,
            invoiceId: inv.id,
            amount: total,
            currency: "USD",
            method: rand(["bank", "bank", "bank", "card"]),
            reference: `ACH-${randInt(100000, 999999)}`,
            paidAt: daysAgo(randInt(0, 30)),
          },
        });
      }
    } catch (e) {
      if (e.code !== "P2002") throw e;
    }
  }
  console.log(`  ✅ ~18 invoices`);

  // Expenses
  const expTypes = ["FUEL", "TOLL", "PARKING", "REPAIR", "OTHER"];
  for (let i = 0; i < 30; i++) {
    const type = rand(expTypes);
    const descs = US_EXPENSE_DESCS[type] ?? ["Miscellaneous expense"];
    await prisma.expense.create({
      data: {
        companyId: cid,
        type,
        amount: randInt(50, 3000),
        currency: "USD",
        description: rand(descs),
        occurredAt: daysAgo(randInt(0, 90)),
        truckId: Math.random() > 0.3 ? rand(trucks).id : undefined,
        driverId: Math.random() > 0.3 ? rand(driverProfiles).id : undefined,
        status: rand(["PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED"]),
        reportedById: rand([disp1.id, disp2.id]),
        approvedById: accountant.id,
        approvedAt: daysAgo(randInt(0, 60)),
      },
    });
  }
  console.log(`  ✅ 30 expenses`);

  // Fuel entries
  for (let i = 0; i < 30; i++) {
    const gallons = randInt(80, 300); // US gallons
    const ppg = randFloat(3.80, 4.90, 3); // price per gallon USD
    await prisma.fuelEntry.create({
      data: {
        companyId: cid,
        truckId: rand(trucks).id,
        driverId: rand(driverProfiles).id,
        liters: +(gallons * 3.78541).toFixed(0), // store in liters
        pricePerLiter: +(ppg / 3.78541).toFixed(4),
        totalAmount: +(gallons * ppg).toFixed(2),
        currency: "USD",
        station: rand(US_FUEL_STATIONS),
        mileage: randInt(80000, 900000),
        occurredAt: daysAgo(randInt(0, 90)),
      },
    });
  }
  console.log(`  ✅ 30 fuel entries`);

  // Maintenance
  const maintStatuses = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "COMPLETED"];
  const maintTitles = [
    "50,000-mile service", "Annual DOT inspection", "Brake adjustment",
    "Oil & filter change", "ELD device inspection",
    "Steering system repair", "Drive tire replacement",
  ];
  for (const truck of trucks) {
    const mstatus = rand(maintStatuses);
    await prisma.maintenance.create({
      data: {
        companyId: cid,
        truckId: truck.id,
        title: rand(maintTitles),
        description: "Scheduled maintenance per fleet service plan.",
        scheduledAt: daysAgo(randInt(-30, 20)),
        completedAt: mstatus === "COMPLETED" ? daysAgo(randInt(0, 15)) : null,
        cost: randInt(400, 10000),
        currency: "USD",
        mileage: randInt(80000, 900000),
        partsReplaced: rand([
          ["oil filter", "air filter", "fuel filter"],
          ["front brake shoes", "brake drums"],
          ["serpentine belt", "water pump"],
          ["engine oil 15W-40", "cabin air filter"],
          [],
        ]),
        status: mstatus,
        notes: Math.random() > 0.5 ? "Verified per FMCSA regulations." : null,
      },
    });
  }
  console.log(`  ✅ ${trucks.length} maintenance records`);

  // Notifications
  await prisma.notification.createMany({
    data: [
      { userId: disp1.id, companyId: cid, type: "LOAD_UPDATE", title: "New load assigned", body: `${driverProfiles[0].firstName} ${driverProfiles[0].lastName} has accepted a new load.`, link: "/dispatch/loads" },
      { userId: disp2.id, companyId: cid, type: "LOAD_UPDATE", title: "Load delivered", body: "A load has been marked as DELIVERED.", link: "/dispatch/loads" },
      { userId: adminUser.id, companyId: cid, type: "INVOICE_DUE", title: "Invoices due this week", body: "You have invoices due within 7 days.", link: "/accounting/invoices" },
      { userId: accountant.id, companyId: cid, type: "INFO", title: "Expenses pending approval", body: "New expense reports need your review.", link: "/accounting/expenses" },
      { userId: fleetMgr.id, companyId: cid, type: "DOCUMENT_EXPIRING", title: "Truck insurance expiring", body: `Truck ${trucks[0].plateNumber}: insurance expiring soon.`, link: "/fleet/trucks" },
      { userId: disp1.id, companyId: cid, type: "INFO", title: "GPS signal lost", body: `No GPS data received from ${driverProfiles[1].firstName} for 2 hours.`, link: "/dispatch/map" },
    ],
  });

  // Audit log
  await prisma.auditLog.createMany({
    data: [
      { companyId: cid, userId: adminUser.id, action: "company.update", entityType: "Company", entityId: cid },
      { companyId: cid, userId: disp1.id, action: "load.create", entityType: "Load" },
      { companyId: cid, userId: disp1.id, action: "load.assign", entityType: "Load" },
      { companyId: cid, userId: accountant.id, action: "invoice.create", entityType: "Invoice" },
      { companyId: cid, userId: accountant.id, action: "payment.record", entityType: "Payment" },
      { companyId: cid, userId: fleetMgr.id, action: "truck.update", entityType: "Truck", entityId: trucks[0].id },
      { companyId: cid, userId: fleetMgr.id, action: "maintenance.create", entityType: "Maintenance" },
    ],
  });

  return { company, driverProfiles, trucks, trailers, customers, adminUser, disp1, disp2 };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚛  TMS — Reset & US Seed\n");

  await clearAll();

  console.log("🌱  Seeding company 1: Soho Transport LLC...");
  const c1 = await seedCompany({
    name: "Soho Transport LLC",
    legalName: "SOHO TRANSPORT LLC",
    taxId: "47-1234567",
    adminEmail: "admin@sohotransport.com",
    adminName: "Stefan Racu",
    emailDomain: "sohotransport.com",
    city: "Dallas, TX",
    state: "TX",
    zip: "75201",
    invoicePrefix: "STL",
  });

  console.log("\n🌱  Seeding company 2: Eagle Freight Inc...");
  const c2 = await seedCompany({
    name: "Eagle Freight Inc",
    legalName: "EAGLE FREIGHT INC",
    taxId: "83-9876543",
    adminEmail: "admin@eaglefreight.com",
    adminName: "Admin Eagle Freight",
    emailDomain: "eaglefreight.com",
    city: "Atlanta, GA",
    state: "GA",
    zip: "30301",
    invoicePrefix: "EFI",
  });

  console.log("\n\n✅  US Seed complete!");
  console.log("═".repeat(64));
  console.log(`  SUPER ADMIN     → ${SUPER_ADMIN_EMAIL}  (password unchanged)`);
  console.log("─".repeat(64));
  console.log("  Company 1: Soho Transport LLC (Dallas, TX)");
  console.log(`  Admin           → admin@sohotransport.com          / ${PASSWORD}`);
  console.log(`  Dispatch 1      → dispatch1@sohotransport.com      / ${PASSWORD}`);
  console.log(`  Dispatch 2      → dispatch2@sohotransport.com      / ${PASSWORD}`);
  console.log(`  Accounting      → accounting@sohotransport.com     / ${PASSWORD}`);
  console.log(`  Fleet Mgr       → fleet@sohotransport.com          / ${PASSWORD}`);
  console.log(`  Drivers         → james.mitchell / william.harris / david.robinson`);
  console.log(`                    michael.walker / thomas.hall / charles.young`);
  console.log(`                    @sohotransport.com               / ${PASSWORD}`);
  console.log("─".repeat(64));
  console.log("  Company 2: Eagle Freight Inc (Atlanta, GA)");
  console.log(`  Admin           → admin@eaglefreight.com           / ${PASSWORD}`);
  console.log(`  Dispatch 1      → dispatch1@eaglefreight.com       / ${PASSWORD}`);
  console.log(`  Drivers         → james.mitchell / ... @eaglefreight.com / ${PASSWORD}`);
  console.log("─".repeat(64));
  console.log(`  Total: ${c1.driverProfiles.length + c2.driverProfiles.length} drivers · ${c1.trucks.length + c2.trucks.length} trucks · ${c1.trailers.length + c2.trailers.length} trailers · ${c1.customers.length + c2.customers.length} customers`);
  console.log(`         ~80 loads · ~36 invoices · ~60 expenses · ~60 fuel entries`);
  console.log("═".repeat(64));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
