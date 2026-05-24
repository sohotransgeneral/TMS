// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const isPublic = (path: string) =>
  PUBLIC_PATHS.includes(path) || path.startsWith("/api/auth");

/**
 * Path prefixes each role is allowed to access.
 * SUPER_ADMIN and COMPANY_ADMIN have no restrictions (handled below).
 */
const ROLE_ALLOWED_PREFIXES: Partial<Record<UserRole, string[]>> = {
  DRIVER: ["/driver", "/api"],
  CUSTOMER: ["/customer", "/accounting/invoices", "/api"],
  DISPATCHER: ["/dashboard", "/dispatch", "/fleet", "/customers", "/admin/drivers", "/api"],
  FLEET_MANAGER: ["/dashboard", "/fleet", "/admin/drivers", "/api"],
  ACCOUNTANT: ["/dashboard", "/accounting", "/customers", "/dispatch/loads", "/api"],
};

/** Default landing page per role */
const ROLE_DEFAULT: Partial<Record<UserRole, string>> = {
  DRIVER: "/driver/dashboard",
  CUSTOMER: "/customer/loads",
  DISPATCHER: "/dispatch/loads",
  FLEET_MANAGER: "/fleet/trucks",
  ACCOUNTANT: "/accounting/dashboard",
  COMPANY_ADMIN: "/dashboard",
  SUPER_ADMIN: "/dashboard",
};

function isAllowed(role: UserRole, pathname: string): boolean {
  if (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") return true;
  const allowed = ROLE_ALLOWED_PREFIXES[role];
  if (!allowed) return false;
  return allowed.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  const user = session?.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const role = user.role as UserRole | undefined;

  // If role is missing from the JWT (old session), force re-login
  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (!isAllowed(role, pathname)) {
    const dest = ROLE_DEFAULT[role] ?? "/dashboard";
    const url = req.nextUrl.clone();
    url.pathname = dest;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
