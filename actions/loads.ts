"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { canActOnCompany, failure, success, type ActionResult } from "@/lib/action-helpers";
import {
  loadCreateSchema,
  loadUpdateSchema,
  loadAssignSchema,
  loadStatusSchema,
  LOAD_NEXT_STATUSES,
} from "@/lib/validators/load";
import {
  nextLoadReference,
  lowestLoadSequence,
  resequenceLoadReferences,
} from "@/lib/load-reference";
import {
  lowestInvoiceSequence,
  resequenceInvoiceNumbers,
} from "@/lib/invoice-number";
import { drivingMiles, resolvePoint, type LatLng } from "@/lib/distance";
import { computeDeadhead, type DeadheadResult } from "@/lib/load-miles";
import { canForceLoadStatus } from "@/lib/permissions";
import {
  parseAccessorials,
  serializeAccessorials,
  accessorialsTotal,
} from "@/lib/accessorials";
import { notifyEvent } from "@/lib/notifications";
import { sendTelegramMessage } from "@/lib/telegram";
import { appUrl } from "@/lib/app-url";
import { randomUUID } from "crypto";

/** Build a clean multi-line notification body for load events. */
function loadNotifyBody(args: {
  pickupCity?: string | null;
  pickupAddress?: string | null;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
  driverName?: string | null;
  truckPlate?: string | null;
  poNumber?: string | null;
  customerName?: string | null;
  price?: number | null;
  currency?: string | null;
  loadType?: string | null;
  note?: string | null;
}): string {
  const lines: string[] = [
    `📦 ${args.pickupCity ?? args.pickupAddress ?? "Pickup"} → ${args.deliveryCity ?? args.deliveryAddress ?? "Delivery"}`,
  ];
  if (args.customerName) lines.push(`Customer: ${args.customerName}`);
  const details: string[] = [];
  if (args.driverName) details.push(`Driver: ${args.driverName}`);
  if (args.truckPlate) details.push(`Truck: ${args.truckPlate}`);
  if (details.length) lines.push(details.join(" | "));
  const extras: string[] = [];
  if (args.loadType) extras.push(args.loadType);
  if (args.price != null)
    extras.push(
      `${args.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${
        args.currency ?? "USD"
      }`,
    );
  if (extras.length) lines.push(extras.join(" | "));
  if (args.poNumber) lines.push(`PO: ${args.poNumber}`);
  if (args.note) lines.push(`Note: ${args.note}`);
  return lines.join("\n");
}

/**
 * Accessorials arrive as a JSON list of line items (name + charge + proof doc).
 * The load's `accessorialAmount` is always their sum, so the Total shown on the
 * load and the Total charged on the invoice can never drift apart.
 */
function normalizeAccessorials(d: {
  accessorials?: string;
  accessorialAmount?: number;
}) {
  const items = parseAccessorials(d.accessorials);
  if (!items.length) return;
  d.accessorials = serializeAccessorials(items);
  d.accessorialAmount = accessorialsTotal(items);
}

function pointOf(
  lat: number | null | undefined,
  lng: number | null | undefined,
): LatLng | null {
  return lat != null && lng != null ? { lat, lng } : null;
}

export async function createLoad(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("loads:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = loadCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;

  // Dispatcher creates with driver → auto-accepted, no manual confirmation needed
  const status: "DRIVER_ACCEPTED" | "DRAFT" = d.driverId
    ? "DRIVER_ACCEPTED"
    : "DRAFT";

  normalizeAccessorials(d);

  // Geocode pickup/delivery if coords not provided
  const [pickupPoint, deliveryPoint] = await Promise.all([
    resolvePoint({
      lat: d.pickupLat, lng: d.pickupLng, address: d.pickupAddress,
      city: d.pickupCity, state: d.pickupState, zip: d.pickupZip, country: d.pickupCountry,
    }),
    resolvePoint({
      lat: d.deliveryLat, lng: d.deliveryLng, address: d.deliveryAddress,
      city: d.deliveryCity, state: d.deliveryState, zip: d.deliveryZip, country: d.deliveryCountry,
    }),
  ]);
  if (pickupPoint) { d.pickupLat = pickupPoint.lat; d.pickupLng = pickupPoint.lng; }
  if (deliveryPoint) { d.deliveryLat = deliveryPoint.lat; d.deliveryLng = deliveryPoint.lng; }

  // Loaded miles on the road, unless the dispatcher typed a number themselves
  if (d.estimatedDistanceKm == null) {
    const miles = await drivingMiles(pickupPoint, deliveryPoint);
    if (miles != null) d.estimatedDistanceKm = miles;
  }

  // Deadhead — empty miles from the driver's previous drop to this pickup.
  // Opt-in per load; the previous trip is found the same way regardless of
  // whether that older load had tracking on.
  let deadhead: DeadheadResult | null = null;
  if (d.trackDeadhead && d.driverId && pickupPoint) {
    deadhead = await computeDeadhead({
      companyId: me.companyId,
      driverId: d.driverId,
      pickup: pickupPoint,
      pickupDate: d.pickupDate,
    });
  }

  const buildData = (referenceNumber: string) => ({
      companyId: me.companyId!,
      referenceNumber,
      customerId: d.customerId || null,
      pickupCompanyName: d.pickupCompanyName,
      pickupAddress: d.pickupAddress,
      pickupCity: d.pickupCity,
      pickupState: d.pickupState,
      pickupZip: d.pickupZip,
      pickupCountry: d.pickupCountry,
      pickupLat: d.pickupLat,
      pickupLng: d.pickupLng,
      pickupDate: d.pickupDate,
      pickupWindow: d.pickupWindow,
      pickupTimezone: d.pickupTimezone,
      pickupContact: d.pickupContact,
      pickupPhone: d.pickupPhone,
      pickupNotes: d.pickupNotes,
      deliveryCompanyName: d.deliveryCompanyName,
      deliveryAddress: d.deliveryAddress,
      deliveryCity: d.deliveryCity,
      deliveryState: d.deliveryState,
      deliveryZip: d.deliveryZip,
      deliveryCountry: d.deliveryCountry,
      deliveryLat: d.deliveryLat,
      deliveryLng: d.deliveryLng,
      deliveryDate: d.deliveryDate,
      deliveryWindow: d.deliveryWindow,
      deliveryTimezone: d.deliveryTimezone,
      deliveryContact: d.deliveryContact,
      deliveryPhone: d.deliveryPhone,
      deliveryNotes: d.deliveryNotes,
      loadType: d.loadType,
      equipment: d.equipment,
      commodity: d.commodity,
      accessorials: d.accessorials,
      loadNumber: d.loadNumber,
      pickupNumber: d.pickupNumber,
      deliveryNumber: d.deliveryNumber,
      enteredBy: d.enteredBy,
      invoicingCompany: d.invoicingCompany,
      billingMethod: d.billingMethod,
      billingType: d.billingType,
      loadInvoiceNumber: d.loadInvoiceNumber,
      accessorialAmount: d.accessorialAmount,
      cargoDescription: d.cargoDescription,
      weightKg: d.weightKg,
      volumeM3: d.volumeM3,
      packages: d.packages,
      isHazardous: d.isHazardous ?? false,
      temperature: d.temperature,
      price: d.price,
      currency: d.currency,
      lineHaulRate: d.lineHaulRate,
      fuelSurcharge: d.fuelSurcharge,
      estimatedDistanceKm: d.estimatedDistanceKm,
      trackDeadhead: d.trackDeadhead ?? false,
      deadheadMiles: deadhead?.miles ?? null,
      deadheadOrigin: deadhead?.origin ?? null,
      poNumber: d.poNumber,
      soNumber: d.soNumber,
      brokerName: d.brokerName,
      brokerPhone: d.brokerPhone,
      brokerEmail: d.brokerEmail,
      specialInstructions: d.specialInstructions,
      driverId: d.driverId || null,
      truckId: d.truckId || null,
      trailerId: d.trailerId || null,
      internalNotes: d.internalNotes,
      dispatchNotes: d.dispatchNotes,
      status,
      dispatcherId: me.id,
      createdById: me.id,
      statusHistory: {
        create: { status, changedById: me.id, note: "Load created" },
      },
  });

  // Two dispatchers saving in the same moment read the same highest reference,
  // so one of them loses the unique index. Take the next free number and try
  // again rather than handing the user a database error.
  let load;
  for (let attempt = 0; ; attempt++) {
    const referenceNumber = await nextLoadReference(me.companyId);
    try {
      load = await prisma.load.create({ data: buildData(referenceNumber) });
      break;
    } catch (err) {
      const duplicate =
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002";
      if (!duplicate || attempt >= 4) throw err;
    }
  }
  const referenceNumber = load.referenceNumber;

  await logAudit({
    action: "load.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: load.id,
    meta: { referenceNumber },
  });

  // Notifications: dispatchers/admins always; assigned driver if any
  // Fetch driver + truck + customer for rich notification body
  const [assignedDriver, assignedTruck, assignedCustomer] = await Promise.all([
    load.driverId
      ? prisma.driverProfile.findUnique({ where: { id: load.driverId }, select: { userId: true, firstName: true, lastName: true } })
      : null,
    load.truckId
      ? prisma.truck.findUnique({ where: { id: load.truckId }, select: { plateNumber: true } })
      : null,
    load.customerId
      ? prisma.customer.findUnique({ where: { id: load.customerId }, select: { name: true } })
      : null,
  ]);
  await notifyEvent({
    companyId: me.companyId,
    topic: "loads",
    type: status === "DRIVER_ACCEPTED" ? "LOAD_ASSIGNED" : "LOAD_CREATED",
    title:
      status === "DRIVER_ACCEPTED"
        ? `Load ${referenceNumber} assigned`
        : `Load ${referenceNumber} created`,
    body: loadNotifyBody({
      pickupCity: d.pickupCity, pickupAddress: d.pickupAddress,
      deliveryCity: d.deliveryCity, deliveryAddress: d.deliveryAddress,
      driverName: assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : null,
      truckPlate: assignedTruck?.plateNumber,
      customerName: assignedCustomer?.name,
      price: d.price,
      currency: d.currency,
      loadType: d.loadType,
      poNumber: d.poNumber,
    }),
    link: `/dispatch/loads/${load.id}`,
    roles: ["COMPANY_ADMIN", "DISPATCHER"],
    userIds: assignedDriver?.userId ? [assignedDriver.userId] : undefined,
  });

  revalidatePath("/dispatch/loads");
  return success({ id: load.id, referenceNumber }, `Load ${referenceNumber} created.`);
}

export async function updateLoad(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("loads:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = loadUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, ...rest } = parsed.data;

  const target = await prisma.load.findUnique({ where: { id } });
  if (!target || !canActOnCompany(me, target.companyId)) return failure("Load not found.");
  if (["PAID", "CANCELLED"].includes(target.status)) {
    return failure("Load can no longer be modified.");
  }

  normalizeAccessorials(rest);

  // Re-geocode if the address changed but coords weren't supplied
  const pickupChanged =
    rest.pickupAddress != null && rest.pickupAddress !== target.pickupAddress;
  const deliveryChanged =
    rest.deliveryAddress != null && rest.deliveryAddress !== target.deliveryAddress;

  let pickupPoint: LatLng | null = null;
  let deliveryPoint: LatLng | null = null;

  if (rest.pickupAddress) {
    pickupPoint = await resolvePoint({
      lat: pickupChanged ? rest.pickupLat : (rest.pickupLat ?? target.pickupLat),
      lng: pickupChanged ? rest.pickupLng : (rest.pickupLng ?? target.pickupLng),
      address: rest.pickupAddress, city: rest.pickupCity, state: rest.pickupState,
      zip: rest.pickupZip, country: rest.pickupCountry,
    });
    if (pickupPoint) { rest.pickupLat = pickupPoint.lat; rest.pickupLng = pickupPoint.lng; }
  }
  if (rest.deliveryAddress) {
    deliveryPoint = await resolvePoint({
      lat: deliveryChanged ? rest.deliveryLat : (rest.deliveryLat ?? target.deliveryLat),
      lng: deliveryChanged ? rest.deliveryLng : (rest.deliveryLng ?? target.deliveryLng),
      address: rest.deliveryAddress, city: rest.deliveryCity, state: rest.deliveryState,
      zip: rest.deliveryZip, country: rest.deliveryCountry,
    });
    if (deliveryPoint) { rest.deliveryLat = deliveryPoint.lat; rest.deliveryLng = deliveryPoint.lng; }
  }

  // Recompute loaded miles when either end moved and no manual value was sent
  if (rest.estimatedDistanceKm == null && (pickupChanged || deliveryChanged || target.estimatedDistanceKm == null)) {
    const miles = await drivingMiles(
      pickupPoint ?? pointOf(target.pickupLat, target.pickupLng),
      deliveryPoint ?? pointOf(target.deliveryLat, target.deliveryLng),
    );
    if (miles != null) rest.estimatedDistanceKm = miles;
  }

  // Deadhead follows the driver and the pickup, so recompute when either is in play
  const driverId = rest.driverId === undefined ? target.driverId : rest.driverId || null;
  const pickupDate = rest.pickupDate ?? target.pickupDate;
  const pickupFrom = pickupPoint ?? pointOf(target.pickupLat, target.pickupLng);
  const trackDeadhead = rest.trackDeadhead ?? target.trackDeadhead;
  let deadhead: DeadheadResult | null = null;
  if (trackDeadhead && driverId && pickupFrom) {
    deadhead = await computeDeadhead({
      companyId: me.companyId,
      driverId,
      pickup: pickupFrom,
      pickupDate,
      excludeLoadId: id,
    });
  }
  // Only overwrite what we actually know: a failed lookup (no token, Mapbox
  // down) must not wipe a good number. Dropping the driver does clear it.
  const driverChanged = driverId !== target.driverId;
  const deadheadWrite =
    deadhead != null
      ? { deadheadMiles: deadhead.miles, deadheadOrigin: deadhead.origin }
      : !trackDeadhead || !driverId || driverChanged
        ? { deadheadMiles: null, deadheadOrigin: null }
        : {};

  await prisma.load.update({
    where: { id },
    data: {
      ...rest,
      ...deadheadWrite,
      customerId: rest.customerId === undefined ? undefined : rest.customerId || null,
      driverId: rest.driverId === undefined ? undefined : rest.driverId || null,
      truckId: rest.truckId === undefined ? undefined : rest.truckId || null,
      trailerId: rest.trailerId === undefined ? undefined : rest.trailerId || null,
    },
  });

  await logAudit({
    action: "load.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: id,
  });

  revalidatePath("/dispatch/loads");
  revalidatePath(`/dispatch/loads/${id}`);
  return success(undefined, "Load updated.");
}

export async function assignLoad(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("loads:assign");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = loadAssignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, driverId, truckId, trailerId } = parsed.data;

  const target = await prisma.load.findUnique({ where: { id } });
  if (!target || !canActOnCompany(me, target.companyId)) return failure("Load not found.");

  // When a dispatcher assigns a driver, the load is auto-accepted —
  // drivers don't need to manually confirm loads given to them.
  const wasUnassigned = ["DRAFT", "ASSIGNED"].includes(target.status) && !!driverId;
  const newStatus = wasUnassigned ? "DRIVER_ACCEPTED" : target.status;

  // The empty run depends on which driver takes the load, so recompute it here
  const pickupPoint = await resolvePoint({
    lat: target.pickupLat, lng: target.pickupLng, address: target.pickupAddress,
    city: target.pickupCity, state: target.pickupState, zip: target.pickupZip,
    country: target.pickupCountry,
  });
  const deadhead =
    target.trackDeadhead && driverId && pickupPoint
      ? await computeDeadhead({
          companyId: me.companyId,
          driverId,
          pickup: pickupPoint,
          pickupDate: target.pickupDate,
          excludeLoadId: id,
        })
      : null;
  // Keep the stored value when the lookup simply failed for the same driver.
  const deadheadWrite =
    deadhead != null
      ? { deadheadMiles: deadhead.miles, deadheadOrigin: deadhead.origin }
      : !target.trackDeadhead || !driverId || driverId !== target.driverId
        ? { deadheadMiles: null, deadheadOrigin: null }
        : {};

  await prisma.load.update({
    where: { id },
    data: {
      driverId: driverId || null,
      truckId: truckId || null,
      trailerId: trailerId || null,
      status: newStatus,
      ...deadheadWrite,
      dispatcherId: target.dispatcherId ?? me.id,
      ...(wasUnassigned && {
        statusHistory: {
          createMany: {
            data: [
              { status: "ASSIGNED", changedById: me.id, note: "Load assigned by dispatcher" },
              { status: "DRIVER_ACCEPTED", changedById: me.id, note: "Auto-accepted (dispatcher assigned)" },
            ],
          },
        },
      }),
    },
  });

  await logAudit({
    action: "load.assign",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: id,
    meta: { driverId, truckId, trailerId },
  });

  if (driverId && wasUnassigned) {
    const [assignDriver, assignTruck, assignCustomer] = await Promise.all([
      prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true, firstName: true, lastName: true } }),
      truckId ? prisma.truck.findUnique({ where: { id: truckId }, select: { plateNumber: true } }) : null,
      target.customerId ? prisma.customer.findUnique({ where: { id: target.customerId }, select: { name: true } }) : null,
    ]);

    await notifyEvent({
      companyId: me.companyId,
      topic: "loads",
      type: "LOAD_ASSIGNED",
      title: `Load ${target.referenceNumber} assigned`,
      body: loadNotifyBody({
        pickupCity: target.pickupCity, pickupAddress: target.pickupAddress,
        deliveryCity: target.deliveryCity, deliveryAddress: target.deliveryAddress,
        driverName: assignDriver ? `${assignDriver.firstName} ${assignDriver.lastName}` : null,
        truckPlate: assignTruck?.plateNumber,
        customerName: assignCustomer?.name,
        price: target.price,
        currency: target.currency,
        loadType: target.loadType,
        poNumber: target.poNumber,
      }),
      link: `/dispatch/loads/${id}`,
      roles: ["COMPANY_ADMIN", "DISPATCHER"],
      userIds: assignDriver?.userId ? [assignDriver.userId] : undefined,
    });

    // Send magic link to driver's personal Telegram if configured
    if (assignDriver?.userId) {
      const driverUser = await prisma.user.findUnique({
        where: { id: assignDriver.userId },
        select: { telegramChatId: true },
      });
      if (driverUser?.telegramChatId) {
        const magicToken = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await prisma.user.update({
          where: { id: assignDriver.userId },
          data: { magicToken, magicTokenExpiresAt: expiresAt },
        });
        const next = encodeURIComponent(`/dispatch/loads/${id}`);
        const magicLink = appUrl(`/api/auth/magic?token=${magicToken}&next=${next}`);
        await sendTelegramMessage({
          chatId: driverUser.telegramChatId,
          text: [
            `🚛 <b>Load assigned: ${target.referenceNumber}</b>`,
            ``,
            `📍 <b>Pickup:</b> ${target.pickupCity ?? target.pickupAddress}`,
            `📍 <b>Delivery:</b> ${target.deliveryCity ?? target.deliveryAddress}`,
            assignTruck ? `🚚 <b>Truck:</b> ${assignTruck.plateNumber}` : null,
            ``,
            `👇 <b>Open app (auto login):</b>`,
            `<a href="${magicLink}">${magicLink}</a>`,
          ].filter(Boolean).join("\n"),
          disableLinkPreview: false,
        });
      }
    }
  }

  revalidatePath("/dispatch/loads");
  revalidatePath(`/dispatch/loads/${id}`);
  revalidatePath("/driver/dashboard");
  return success(undefined, "Assignment saved.");
}

export async function changeLoadStatus(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("loads:update_status");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = loadStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, status, note, lat, lng } = parsed.data;

  const target = await prisma.load.findUnique({
    where: { id },
    include: {
      driver: true,
      truck: { select: { plateNumber: true } },
      customer: { select: { name: true } },
    },
  });
  if (!target || !canActOnCompany(me, target.companyId)) return failure("Load not found.");

  // Drivers can only update statuses of their own loads
  if (me.role === "DRIVER") {
    if (!target.driver || target.driver.userId !== me.id) {
      return failure("You do not have access to this load.");
    }
  }

  // Validate transition (admins can force any change)
  const allowed = LOAD_NEXT_STATUSES[target.status] ?? [];
  const canForce = canForceLoadStatus(me.role);
  if (!allowed.includes(status) && status !== target.status && !canForce) {
    return failure(`Invalid transition: ${target.status} → ${status}.`);
  }

  await prisma.load.update({
    where: { id },
    data: {
      status,
      statusHistory: {
        create: { status, note, lat, lng, changedById: me.id },
      },
    },
  });

  await logAudit({
    action: "load.status",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: id,
    meta: { status, note },
  });

  await notifyEvent({
    companyId: me.companyId,
    topic: "loads",
    type: "LOAD_STATUS",
    title: `Load ${target.referenceNumber}: ${status}`,
    body: loadNotifyBody({
      pickupCity: target.pickupCity, pickupAddress: target.pickupAddress,
      deliveryCity: target.deliveryCity, deliveryAddress: target.deliveryAddress,
      driverName: target.driver ? `${target.driver.firstName} ${target.driver.lastName}` : null,
      truckPlate: target.truck?.plateNumber,
      customerName: target.customer?.name,
      price: target.price,
      currency: target.currency,
      loadType: target.loadType,
      poNumber: target.poNumber,
      note,
    }),
    link: `/dispatch/loads/${id}`,
    roles: ["COMPANY_ADMIN", "DISPATCHER"],
    userIds: target.driver?.userId ? [target.driver.userId] : undefined,
  });

  revalidatePath("/dispatch/loads");
  revalidatePath(`/dispatch/loads/${id}`);
  revalidatePath("/driver/dashboard");
  return success(undefined, "Status actualizat.");
}

/**
 * Deletes a load and everything hanging off it — status history, documents and
 * GPS pings all cascade away.
 *
 * An invoiced load takes its invoice and that invoice's payments with it.
 * Leaving the invoice behind unlinked is not an option: `Invoice.loadId` is a
 * unique index, so clearing a second one to null collides with whichever
 * invoice already has no load — that collision was the 500 seen when deleting
 * an invoiced load.
 *
 * Expenses and fuel entries are kept and only unlinked, so costs already
 * booked against the load stay in the accounting.
 */
export async function deleteLoad(id: string): Promise<ActionResult> {
  const me = await requirePermission("loads:write");
  const target = await prisma.load.findUnique({
    where: { id },
    include: { invoice: { select: { id: true, number: true } } },
  });
  if (!target || !canActOnCompany(me, target.companyId)) return failure("Load not found.");

  if (target.invoice) {
    const invoiceBase = await lowestInvoiceSequence(target.companyId);
    await prisma.payment.deleteMany({ where: { invoiceId: target.invoice.id } });
    await prisma.invoice.delete({ where: { id: target.invoice.id } });
    if (invoiceBase != null) {
      await resequenceInvoiceNumbers(target.companyId, invoiceBase);
    }
  }
  // Captured before the delete so removing the first load pulls the rest
  // down to where the sequence started, rather than leaving it one higher.
  const base = await lowestLoadSequence(target.companyId);

  await prisma.load.delete({ where: { id } });
  if (base != null) await resequenceLoadReferences(target.companyId, base);

  await logAudit({
    action: "load.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: id,
    meta: {
      referenceNumber: target.referenceNumber,
      status: target.status,
      invoiceNumber: target.invoice?.number ?? null,
    },
  });
  revalidatePath("/dispatch/loads");
  revalidatePath("/dispatch/cockpit");
  return success(
    undefined,
    target.invoice
      ? `Load ${target.referenceNumber} and invoice ${target.invoice.number} deleted.`
      : `Load ${target.referenceNumber} deleted.`,
  );
}

/** Driver acknowledges receiving the load. */
export async function acceptLoad(id: string): Promise<ActionResult> {
  const me = await requirePermission("loads:update_status");
  const load = await prisma.load.findUnique({
    where: { id },
    include: {
      driver: true,
      truck: { select: { plateNumber: true } },
      customer: { select: { name: true } },
    },
  });
  if (!load || !canActOnCompany(me, load.companyId)) return failure("Load not found.");
  if (load.driver?.userId !== me.id) return failure("You do not have access to this load.");
  if (load.status !== "ASSIGNED") return failure("Load can no longer be accepted.");

  await prisma.load.update({
    where: { id },
    data: {
      status: "DRIVER_ACCEPTED",
      statusHistory: {
        create: { status: "DRIVER_ACCEPTED", changedById: me.id, note: "Accepted by driver" },
      },
    },
  });

  if (load.companyId) {
    await notifyEvent({
      companyId: load.companyId,
      topic: "loads",
      type: "LOAD_ACCEPTED",
      title: `Load ${load.referenceNumber} accepted by driver`,
      body: loadNotifyBody({
        pickupCity: load.pickupCity, pickupAddress: load.pickupAddress,
        deliveryCity: load.deliveryCity, deliveryAddress: load.deliveryAddress,
        driverName: load.driver ? `${load.driver.firstName} ${load.driver.lastName}` : null,
        truckPlate: load.truck?.plateNumber,
        customerName: load.customer?.name,
        price: load.price,
        currency: load.currency,
        loadType: load.loadType,
        poNumber: load.poNumber,
      }),
      link: `/dispatch/loads/${id}`,
      roles: ["COMPANY_ADMIN", "DISPATCHER"],
    });
  }

  revalidatePath(`/dispatch/loads/${id}`);
  revalidatePath("/driver/dashboard");
  return success(undefined, "Load accepted.");
}
