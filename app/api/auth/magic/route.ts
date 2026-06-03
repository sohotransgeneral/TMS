import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

/**
 * GET /api/auth/magic?token=<magicToken>&next=<path>
 *
 * Auto-authenticates a driver via a one-time magic link token.
 * The token is generated when a dispatcher assigns a load and sent to the
 * driver's personal Telegram chat.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const next = req.nextUrl.searchParams.get("next") ?? "/driver/dashboard";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", req.url));
  }

  const user = await prisma.user.findFirst({
    where: {
      magicToken: token,
      magicTokenExpiresAt: { gt: new Date() },
      active: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=ExpiredToken", req.url),
    );
  }

  // Invalidate the token immediately (one-time use)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      magicToken: null,
      magicTokenExpiresAt: null,
      lastLoginAt: new Date(),
    },
  });

  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    console.error("[magic-link] Neither NEXTAUTH_SECRET nor AUTH_SECRET is set");
    return NextResponse.redirect(
      new URL("/login?error=Configuration", req.url),
    );
  }

  // On Vercel, req.nextUrl.protocol is always "http:" because SSL is terminated
  // at the edge proxy. Use x-forwarded-proto or fall back to NEXTAUTH_URL.
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";
  const isSecure =
    forwardedProto === "https" || baseUrl.startsWith("https://");

  // Cookie name must match what NextAuth v5 uses internally
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const now = Math.floor(Date.now() / 1000);

  const sessionToken = await encode({
    token: {
      // Standard JWT claims required by NextAuth v5
      jti: randomUUID(),
      iat: now,
      exp: now + maxAge,
      sub: user.id,
      // Custom claims set via jwt callback in lib/auth.ts
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      companyId: user.companyId,
    },
    secret,
    salt: cookieName,
    maxAge,
  });

  const dest = next.startsWith("/") ? next : "/driver/dashboard";
  const response = NextResponse.redirect(new URL(dest, req.url));

  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return response;
}
