"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");

  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== me.id) return failure("Notificare inexistentă.");

  await prisma.notification.update({ where: { id }, data: { read: true } });
  revalidatePath("/admin/notifications");
  return success(undefined, "Marcat ca citit.");
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const me = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: me.id, read: false },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
  return success(undefined, "Toate notificările au fost marcate.");
}

export async function deleteNotification(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");

  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== me.id) return failure("Notificare inexistentă.");

  await prisma.notification.delete({ where: { id } });
  revalidatePath("/admin/notifications");
  return success(undefined, "Șters.");
}
