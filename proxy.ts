// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
// Lightweight edge auth gate — full RBAC is enforced in server actions / pages
// via lib/session.ts and lib/permissions.ts.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

const isPublic = (path: string) =>
  PUBLIC_PATHS.includes(path) || path.startsWith("/api/auth");

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Return immediately for public paths — do NOT call auth() here,
  // as that consumes the request body and breaks POST form submissions.
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  const isAuthed = !!session?.user;

  if (!isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimizer
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
