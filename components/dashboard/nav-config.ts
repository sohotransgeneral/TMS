import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Truck,
  Users,
  Building2,
  Package,
  Map,
  Wrench,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  UserCircle2,
  ClipboardList,
  Fuel,
  Bell,
  Container,
  ScrollText,
  Sparkles,
  ShieldCheck,
  Send,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** at least one of these permissions is required, OR matches role in roles[] */
  permissions?: Permission[];
  roles?: UserRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Main",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["COMPANY_ADMIN", "DISPATCHER", "ACCOUNTANT", "SUPER_ADMIN"],
      },
      {
        href: "/driver/dashboard",
        label: "My Loads",
        icon: ClipboardList,
        roles: ["DRIVER"],
      },
      {
        href: "/customer/loads",
        label: "My Loads",
        icon: Package,
        roles: ["CUSTOMER"],
      },
      {
        href: "/customer/invoices",
        label: "My Invoices",
        icon: Receipt,
        roles: ["CUSTOMER"],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/dispatch/loads",
        label: "Loads",
        icon: Package,
        permissions: ["loads:read", "loads:write"],
      },
      {
        href: "/dispatch/cockpit",
        label: "Cockpit",
        icon: LayoutDashboard,
        permissions: ["loads:read"],
      },
      {
        href: "/dispatch/map",
        label: "Live Map",
        icon: Map,
        permissions: ["gps:read"],
      },
    ],
  },
  {
    title: "Fleet",
    items: [
      {
        href: "/fleet/trucks",
        label: "Trucks & Trailers",
        icon: Truck,
        permissions: ["trucks:read"],
      },
      {
        href: "/fleet/maintenance",
        label: "Maintenance",
        icon: Wrench,
        permissions: ["maintenance:read"],
      },
      {
        href: "/admin/drivers",
        label: "Drivers",
        icon: UserCircle2,
        permissions: ["drivers:read"],
      },
      {
        href: "/fleet/permits",
        label: "Permits",
        icon: ShieldCheck,
        permissions: ["trucks:read"],
      },
    ],
  },
  {
    title: "Commercial",
    items: [
      {
        href: "/customers",
        label: "Customers",
        icon: Building2,
        permissions: ["customers:read"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        href: "/accounting/dashboard",
        label: "Financial Overview",
        icon: BarChart3,
        permissions: ["reports:read"],
        roles: ["ACCOUNTANT", "COMPANY_ADMIN", "SUPER_ADMIN"],
      },
      {
        href: "/accounting/invoices",
        label: "Invoices",
        icon: Receipt,
        permissions: ["invoices:read"],
        roles: ["COMPANY_ADMIN", "SUPER_ADMIN", "ACCOUNTANT", "DISPATCHER", "FLEET_MANAGER", "DRIVER"],
      },
      {
        href: "/accounting/expenses",
        label: "Expenses",
        icon: Wallet,
        permissions: ["expenses:read", "expenses:write"],
      },
      {
        href: "/accounting/fuel",
        label: "Fuel",
        icon: Fuel,
        permissions: ["expenses:read"],
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: BarChart3,
        permissions: ["reports:read"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: Users,
        permissions: ["users:write"],
      },
      {
        href: "/admin/company",
        label: "Company",
        icon: Building2,
        permissions: ["company:write"],
      },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: Bell,
      },
      {
        href: "/admin/telegram",
        label: "Telegram",
        icon: Send,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/admin/audit",
        label: "Audit Log",
        icon: ScrollText,
        permissions: ["audit:read"],
      },
      {
        href: "/admin/ai-usage",
        label: "AI Usage",
        icon: Sparkles,
        roles: ["SUPER_ADMIN", "COMPANY_ADMIN"],
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        permissions: ["settings:write"],
      },
    ],
  },
];
