"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface Props {
  role: UserRole;
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  unreadCount?: number;
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  name,
  email,
  companyName,
  companyLogoUrl,
  unreadCount = 0,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-svh overflow-hidden">
      <div className="print:hidden">
        <Sidebar
          role={role}
          open={open}
          onClose={() => setOpen(false)}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
        />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="print:hidden">
          <Topbar
            role={role}
            name={name}
            email={email}
            companyName={companyName}
            unreadCount={unreadCount}
            onMenu={() => setOpen(true)}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-muted/30 print:p-0 print:overflow-visible print:bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
