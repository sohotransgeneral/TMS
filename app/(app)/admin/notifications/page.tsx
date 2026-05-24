import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseListParams } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MarkReadButton,
  DeleteNotificationButton,
  MarkAllReadButton,
} from "@/components/notifications/notification-actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications";
import { formatDate } from "@/lib/utils";
import { Bell } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Notifications" };

type SP = Record<string, string | string[] | undefined>;

const TYPE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  INFO: "secondary",
  SUCCESS: "default",
  WARNING: "outline",
  ERROR: "destructive",
  DOCUMENT_EXPIRING: "outline",
  LOAD_UPDATE: "secondary",
  INVOICE_DUE: "outline",
  MAINTENANCE: "outline",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const { page, pageSize, skip } = parseListParams(sp);
  const filter = typeof sp.filter === "string" ? sp.filter : undefined;

  const where = {
    userId: me.id,
    ...(filter === "unread"
      ? { read: false }
      : filter === "read"
        ? { read: true }
        : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: me.id, read: false } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} necitite din total ${total}.`}
        action={unreadCount > 0 ? <MarkAllReadButton /> : null}
      />

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          paramKey="filter"
          allLabel="Toate"
          options={[
            { value: "unread", label: "Necitite" },
            { value: "read", label: "Citite" },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="Nicio notificare"
          description="Your alerts will appear here."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={n.read ? "" : "border-primary/40 bg-primary/5"}>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={TYPE_VARIANT[n.type] ?? "secondary"}>
                        {NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}
                      </Badge>
                      {!n.read && (
                        <span className="text-xs font-medium text-primary">
                          • nou
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(n.createdAt, true)}
                      </span>
                    </div>
                    <div className="font-medium">
                      {n.link ? (
                        <Link href={n.link} className="hover:underline">
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </div>
                    {n.body && (
                      <p className="text-sm text-muted-foreground">{n.body}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!n.read && <MarkReadButton id={n.id} />}
                    <DeleteNotificationButton id={n.id} />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
