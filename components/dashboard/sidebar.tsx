"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Truck, X } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { hasAnyPermission } from "@/lib/permissions";
import { NAV_GROUPS, type NavItem } from "./nav-config";

interface SidebarProps {
  role: UserRole;
  open?: boolean;
  onClose?: () => void;
  companyName?: string | null;
  companyLogoUrl?: string | null;
}

function isVisible(item: NavItem, role: UserRole) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.permissions && !hasAnyPermission(role, item.permissions))
    return false;
  return true;
}

export function Sidebar({ role, open = false, onClose, companyName, companyLogoUrl }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <nav className="flex flex-col gap-1 p-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between px-2 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold min-w-0"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0 overflow-hidden">
            {companyLogoUrl ? (
              <Image
                src={companyLogoUrl}
                alt={companyName ?? "Logo"}
                width={32}
                height={32}
                className="object-contain h-full w-full"
                unoptimized
              />
            ) : (
              <Truck className="h-4 w-4" />
            )}
          </div>
          <span className="truncate text-sm leading-tight">
            {companyName ?? "TMS"}
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-accent shrink-0"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((i) => isVisible(i, role));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.title} className="mt-4">
            <p className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground h-full">
        {content}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden
          />
          <div className="relative w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground shadow-xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

