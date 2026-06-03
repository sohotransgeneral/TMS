import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/magic?token=<magicToken>
 *
 * Auto-authenticates a driver via a one-time magic link token.
 * The token is generated when a dispatcher assigns a load and sent to the
 * driver's personal Telegram chat. Clicking the link logs them in directly
 * without needing to enter credentials.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

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
    return NextResponse.redirect(new URL("/login?error=ExpiredToken", req.url));
  }

  // Invalidate the token immediately (one-time use)
  await prisma.user.update({
    where: { id: user.id },
    data: { magicToken: null, magicTokenExpiresAt: null, lastLoginAt: new Date() },
  });

  // Build a proper NextAuth v5 JWT session token
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[magic-link] NEXTAUTH_SECRET not set");
    return NextResponse.redirect(new URL("/login?error=Configuration", req.url));
  }

  const isSecure = req.nextUrl.protocol === "https:";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const sessionToken = await encode({
    token: {
      sub: user.id,
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

  const dest = user.role === "DRIVER" ? "/driver/dashboard" : "/dashboard";
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
