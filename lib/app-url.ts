/**
 * lib/app-url.ts
 *
 * The one place that knows where this app lives.
 *
 * Password-reset emails, Telegram notifications and driver magic links all need
 * an absolute URL. They used to build it themselves from different env vars
 * with different fallbacks — so a missing variable meant a link to
 * `localhost:3000`, or worse, a bare path with no host at all.
 *
 * Resolution order, first non-empty wins:
 *   APP_URL → NEXTAUTH_URL → AUTH_URL → VERCEL_URL → PRODUCTION_APP_URL
 *
 * Env vars still take precedence, so local development points at localhost by
 * setting APP_URL, and Vercel preview deploys link to themselves.
 */

/** Where the app is served in production. */
export const PRODUCTION_APP_URL = "https://tms.sohotransllc.com";

function normalize(url: string): string {
  const base = url.trim().replace(/\/+$/, "");
  // A bare host in the env var ("tms.sohotransllc.com") would produce a link
  // no mail client can open.
  return /^https?:\/\//i.test(base) ? base : `https://${base}`;
}

/** Vercel's auto-generated deployment host, never the customer-facing domain. */
function isVercelDeployHost(url: string): boolean {
  return /^https?:\/\/[^/]*\.vercel\.app$/i.test(url);
}

/** Absolute origin of the app, with no trailing slash. */
export function appOrigin(): string {
  // On the production deployment the custom domain always wins. A stale
  // NEXTAUTH_URL left pointing at tms-kappa-vert.vercel.app used to leak into
  // every password-reset email and Telegram link; preview deploys still link
  // to themselves, because there the *.vercel.app host is the right answer.
  const isProduction = process.env.VERCEL_ENV === "production";

  const candidates = [
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const url = normalize(candidate);
    if (isProduction && isVercelDeployHost(url)) continue;
    return url;
  }

  return PRODUCTION_APP_URL;
}

/** Absolute URL for a path inside the app, e.g. appUrl("/dispatch/loads/123"). */
export function appUrl(path = ""): string {
  const origin = appOrigin();
  if (!path) return origin;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
