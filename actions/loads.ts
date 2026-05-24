"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import {
  loadCreateSchema,
  loadUpdateSchema,
  loadAssignSchema,
  loadStatusSchema,
  LOAD_NEXT_STATUSES,
} from "@/lib/validators/load";
import { nextLoadReference } from "@/lib/load-reference";
import { geocodeAddress } from "@/lib/geocode";
import { notifyEvent } from "@/lib/notifications";

export async function createLoad(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("loads:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = loadCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;

  const referenceNumber = await nextLoadReference(me.companyId);
  const status = d.driverId ? "ASSIGNED" : "DRAFT";

  // Geocode pickup/delivery if coords not provided
  if (!d.pickupLat || !d.pickupLng) {
    const geo = await geocodeAddress(
      [d.pickupAddress, d.pickupCity, d.pickupCountry].filter(Boolean).join(", "),
    );
    if (geo) { d.pickupLat = geo.lat; d.pickupLng = geo.lng; }
  }
  if (!d.deliveryLat || !d.deliveryLng) {
    const geo = await geocodeAddress(
      [d.deliveryAddress, d.deliveryCity, d.deliveryCountry].filter(Boolean).join(", "),
    );
    if (geo) { d.deliveryLat = geo.lat; d.deliveryLng = geo.lng; }
  }

  const load = await prisma.load.create({
    data: {
      companyId: me.companyId,
      referenceNumber,
      customerId: d.customerId || null,
      pickupCompanyName: d.pickupCompanyName,
      pickupAddress: d.pickupAddress,
      pickupCity: d.pickupCity,
      pickupCountry: d.pickupCountry,
      pickupLat: d.pickupLat,
      pickupLng: d.pickupLng,
      pickupDate: d.pickupDate,
      pickupWindow: d.pickupWindow,
      pickupContact: d.pickupContact,
      pickupPhone: d.pickupPhone,
      pickupNotes: d.pickupNotes,
      deliveryCompanyName: d.deliveryCompanyName,
      deliveryAddress: d.deliveryAddress,
      deliveryCity: d.deliveryCity,
      deliveryCountry: d.deliveryCountry,
      deliveryLat: d.deliveryLat,
      deliveryLng: d.deliveryLng,
      deliveryDate: d.deliveryDate,
      deliveryWindow: d.deliveryWindow,
      deliveryContact: d.deliveryContact,
      deliveryPhone: d.deliveryPhone,
      deliveryNotes: d.deliveryNotes,
      loadType: d.loadType,
      equipment: d.equipment,
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
      status,
      dispatcherId: me.id,
      createdById: me.id,
      statusHistory: {
        create: { status, changedById: me.id, note: "Load created" },
      },
    },
  });

  await logAudit({
    action: "load.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: load.id,
    meta: { referenceNumber },
  });

  // Notifications: dispatchers/admins always; assigned driver if any
  // Fetch driver + truck for rich notification body
  const [assignedDriver, assignedTruck] = await Promise.all([
    load.driverId
      ? prisma.driverProfile.findUnique({ where: { id: load.driverId }, select: { userId: true, firstName: true, lastName: true } })
      : null,
    load.truckId
      ? prisma.truck.findUnique({ where: { id: load.truckId }, select: { plateNumber: true } })
      : null,
  ]);
  const notifyBodyParts = [
    `${d.pickupCity ?? d.pickupAddress ?? "Pickup"} → ${d.deliveryCity ?? d.deliveryAddress ?? "Delivery"}`,
    assignedDriver ? `Driver: ${assignedDriver.firstName} ${assignedDriver.lastName}` : null,
    assignedTruck ? `Truck: ${assignedTruck.plateNumber}` : null,
    d.poNumber ? `PO: ${d.poNumber}` : null,
  ].filter(Boolean).join(" | ");

  await notifyEvent({
    companyId: me.companyId,
    topic: "loads",
    type: status === "ASSIGNED" ? "LOAD_ASSIGNED" : "LOAD_CREATED",
    title:
      status === "ASSIGNED"
        ? `Load ${referenceNumber} assigned`
        : `Load ${referenceNumber} created`,
    body: notifyBodyParts,
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
  if (!target || target.companyId !== me.companyId) return failure("Load not found.");
  if (["PAID", "CANCELLED"].includes(target.status)) {
    return failure("Load can no longer be modified.");
  }

  // Re-geocode if address changed but coords are missing
  if (rest.pickupAddress && !rest.pickupLat && !rest.pickupLng) {
    const geo = await geocodeAddress(
      [rest.pickupAddress, rest.pickupCity, rest.pickupCountry].filter(Boolean).join(", "),
    );
    if (geo) { rest.pickupLat = geo.lat; rest.pickupLng = geo.lng; }
  }
  if (rest.deliveryAddress && !rest.deliveryLat && !rest.deliveryLng) {
    const geo = await geocodeAddress(
      [rest.deliveryAddress, rest.deliveryCity, rest.deliveryCountry].filter(Boolean).join(", "),
    );
    if (geo) { rest.deliveryLat = geo.lat; rest.deliveryLng = geo.lng; }
  }

  await prisma.load.update({
    where: { id },
    data: {
      ...rest,
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
  if (!target || target.companyId !== me.companyId) return failure("Load not found.");

  const shouldFlip = target.status === "DRAFT" && driverId;
  const newStatus = shouldFlip ? "ASSIGNED" : target.status;

  await prisma.load.update({
    where: { id },
    data: {
      driverId: driverId || null,
      truckId: truckId || null,
      trailerId: trailerId || null,
      status: newStatus,
      dispatcherId: target.dispatcherId ?? me.id,
      ...(shouldFlip && {
        statusHistory: {
          create: { status: "ASSIGNED", changedById: me.id, note: "Load assigned" },
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

  if (driverId && shouldFlip) {
    const [assignDriver, assignTruck] = await Promise.all([
      prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true, firstName: true, lastName: true } }),
      truckId ? prisma.truck.findUnique({ where: { id: truckId }, select: { plateNumber: true } }) : null,
    ]);
    const assignParts = [
      `${target.pickupCity ?? target.pickupAddress ?? "Pickup"} → ${target.deliveryCity ?? target.deliveryAddress ?? "Delivery"}`,
      assignDriver ? `Driver: ${assignDriver.firstName} ${assignDriver.lastName}` : null,
      assignTruck ? `Truck: ${assignTruck.plateNumber}` : null,
      target.poNumber ? `PO: ${target.poNumber}` : null,
    ].filter(Boolean).join(" | ");

    await notifyEvent({
      companyId: me.companyId,
      topic: "loads",
      type: "LOAD_ASSIGNED",
      title: `Load ${target.referenceNumber} assigned`,
      body: assignParts,
      link: `/dispatch/loads/${id}`,
      roles: ["COMPANY_ADMIN", "DISPATCHER"],
      userIds: assignDriver?.userId ? [assignDriver.userId] : undefined,
    });
  }

  revalidatePath("/dispatch/loads");
  revalidatePath(`/dispatch/loads/${id}`);
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
    },
  });
  if (!target || target.companyId !== me.companyId) return failure("Load not found.");

  // Drivers can only update statuses of their own loads
  if (me.role === "DRIVER") {
    if (!target.driver || target.driver.userId !== me.id) {
      return failure("You do not have access to this load.");
    }
  }

  // Validate transition (admins can force any change)
  const allowed = LOAD_NEXT_STATUSES[target.status] ?? [];
  const canForce = me.role === "COMPANY_ADMIN" || me.role === "SUPER_ADMIN";
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

  const statusBodyParts = [
    `${target.pickupCity ?? target.pickupAddress ?? "Pickup"} → ${target.deliveryCity ?? target.deliveryAddress ?? "Delivery"}`,
    target.driver ? `Driver: ${target.driver.firstName} ${target.driver.lastName}` : null,
    target.truck ? `Truck: ${target.truck.plateNumber}` : null,
    target.poNumber ? `PO: ${target.poNumber}` : null,
    note ?? null,
  ].filter(Boolean).join(" | ");

  await notifyEvent({
    companyId: me.companyId,
    topic: "loads",
    type: "LOAD_STATUS",
    title: `Load ${target.referenceNumber}: ${status}`,
    body: statusBodyParts,
    link: `/dispatch/loads/${id}`,
    roles: ["COMPANY_ADMIN", "DISPATCHER"],
  });

  revalidatePath("/dispatch/loads");
  revalidatePath(`/dispatch/loads/${id}`);
  revalidatePath("/driver/dashboard");
  return success(undefined, "Status actualizat.");
}

export async function deleteLoad(id: string): Promise<ActionResult> {
  const me = await requirePermission("loads:write");
  const target = await prisma.load.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Load not found.");
  if (target.status !== "DRAFT" && target.status !== "CANCELLED") {
    return failure("Only DRAFT or CANCELED loads can be deleted.");
  }

  await prisma.load.delete({ where: { id } });
  await logAudit({
    action: "load.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Load",
    entityId: id,
  });
  revalidatePath("/dispatch/loads");
  return success(undefined, "Load deleted.");
}

/** Driver acknowledges receiving the load. */
export async function acceptLoad(id: string): Promise<ActionResult> {
  const me = await requirePermission("loads:update_status");
  const load = await prisma.load.findUnique({
    where: { id },
    include: {
      driver: true,
      truck: { select: { plateNumber: true } },
    },
  });
  if (!load || load.companyId !== me.companyId) return failure("Load not found.");
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
    const acceptParts = [
      `${load.pickupCity ?? load.pickupAddress ?? "Pickup"} → ${load.deliveryCity ?? load.deliveryAddress ?? "Delivery"}`,
      load.driver ? `Driver: ${load.driver.firstName} ${load.driver.lastName}` : null,
      load.truck ? `Truck: ${load.truck.plateNumber}` : null,
      load.poNumber ? `PO: ${load.poNumber}` : null,
    ].filter(Boolean).join(" | ");
    await notifyEvent({
      companyId: load.companyId,
      topic: "loads",
      type: "LOAD_ACCEPTED",
      title: `Load ${load.referenceNumber} accepted by driver`,
      body: acceptParts,
      link: `/dispatch/loads/${id}`,
      roles: ["COMPANY_ADMIN", "DISPATCHER"],
    });
  }

  revalidatePath(`/dispatch/loads/${id}`);
  revalidatePath("/driver/dashboard");
  return success(undefined, "Load accepted.");
}
