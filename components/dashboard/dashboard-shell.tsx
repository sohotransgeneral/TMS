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
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  name,
  email,
  companyName,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-svh overflow-hidden">
      <div className="print:hidden">
        <Sidebar role={role} open={open} onClose={() => setOpen(false)} />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <div className="print:hidden">
          <Topbar
            role={role}
            name={name}
            email={email}
            companyName={companyName}
            onMenu={() => setOpen(true)}
          />
        </div>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-muted/30 print:p-0 print:overflow-visible print:bg-white">
          {children}
        </main>
      </div>
    </div>
  );
}
