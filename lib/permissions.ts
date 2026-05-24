import { UserRole } from "@prisma/client";

/**
 * Role-based access control for the TMS.
 *
 * `Permission` strings follow the pattern `<resource>:<action>`.
 * `ROLE_PERMISSIONS` maps each role to the set of permissions it has.
 * Use `hasPermission(role, permission)` from server code to enforce.
 *
 * SUPER_ADMIN bypasses all checks.
 */
export type Permission =
  // Company / users
  | "company:read"
  | "company:write"
  | "users:read"
  | "users:write"
  | "settings:write"
  // Fleet
  | "trucks:read"
  | "trucks:write"
  | "trailers:read"
  | "trailers:write"
  | "drivers:read"
  | "drivers:write"
  | "maintenance:read"
  | "maintenance:write"
  // Loads
  | "loads:read"
  | "loads:write"
  | "loads:assign"
  | "loads:update_status"
  | "loads:read_own"
  // Customers
  | "customers:read"
  | "customers:write"
  // Finance
  | "invoices:read"
  | "invoices:write"
  | "expenses:read"
  | "expenses:write"
  | "expenses:approve"
  | "payments:write"
  | "reports:read"
  // GPS / docs
  | "gps:write"
  | "gps:read"
  | "documents:read"
  | "documents:write"
  // System
  | "audit:read";

const ALL: Permission[] = [
  "company:read", "company:write", "users:read", "users:write", "settings:write",
  "trucks:read", "trucks:write", "trailers:read", "trailers:write",
  "drivers:read", "drivers:write", "maintenance:read", "maintenance:write",
  "loads:read", "loads:write", "loads:assign", "loads:update_status", "loads:read_own",
  "customers:read", "customers:write",
  "invoices:read", "invoices:write", "expenses:read", "expenses:write", "expenses:approve",
  "payments:write", "reports:read",
  "gps:write", "gps:read", "documents:read", "documents:write",
  "audit:read",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL,

  COMPANY_ADMIN: ALL,

  DISPATCHER: [
    "company:read",
    "trucks:read", "trailers:read", "drivers:read",
    "loads:read", "loads:write", "loads:assign", "loads:update_status",
    "customers:read", "customers:write",
    "documents:read", "documents:write",
    "gps:read", "reports:read",
    "expenses:read",
  ],

  DRIVER: [
    "loads:read_own",
    "loads:update_status",
    "documents:write",
    "gps:write",
    "expenses:read",
    "expenses:write",
  ],

  ACCOUNTANT: [
    "company:read",
    "customers:read",
    "invoices:read", "invoices:write",
    "payments:write",
    "expenses:read", "expenses:write", "expenses:approve",
    "reports:read",
    "documents:read", "documents:write",
    "loads:read",
  ],

  FLEET_MANAGER: [
    "company:read",
    "trucks:read", "trucks:write",
    "trailers:read", "trailers:write",
    "drivers:read", "drivers:write",
    "maintenance:read", "maintenance:write",
    "documents:read", "documents:write",
    "loads:read",
    "reports:read",
    "expenses:read",
  ],

  CUSTOMER: [
    "loads:read_own",
    "invoices:read",
    "documents:read",
  ],
};

export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Throws if the role lacks the permission — for use in server actions / API routes. */
export function assertPermission(
  role: UserRole | null | undefined,
  permission: Permission,
): asserts role is UserRole {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}

/** Default landing path after login, by role. */
export function defaultDashboardFor(role: UserRole): string {
  switch (role) {
    case "DRIVER":
      return "/driver/dashboard";
    case "ACCOUNTANT":
      return "/accounting/dashboard";
    case "DISPATCHER":
      return "/dispatch/loads";
    case "FLEET_MANAGER":
      return "/fleet/trucks";
    case "CUSTOMER":
      return "/customer/loads";
    case "COMPANY_ADMIN":
    case "SUPER_ADMIN":
    default:
      return "/dashboard";
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Company Admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  ACCOUNTANT: "Accountant",
  FLEET_MANAGER: "Fleet Manager",
  CUSTOMER: "Customer",
};
