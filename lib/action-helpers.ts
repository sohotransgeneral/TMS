import "server-only";

/**
 * Shared action helpers. All server actions in `actions/*` return ActionResult
 * so the calling client component can render errors uniformly.
 */
export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function success<T = unknown>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function failure(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Parses `?page=2&pageSize=20&q=...` from server-component searchParams.
 */
export function parseListParams(
  searchParams: Record<string, string | string[] | undefined>,
  defaults: { pageSize?: number } = {},
) {
  const pageSize = Math.min(100, Number(searchParams.pageSize) || defaults.pageSize || 20);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  return { page, pageSize, q, skip: (page - 1) * pageSize };
}

/** Build a Prisma `OR` text search for given fields. */
export function buildSearch(q: string, fields: string[]) {
  if (!q) return undefined;
  return {
    OR: fields.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })),
  };
}

/**
 * Whether the signed-in user may act on a record belonging to `companyId`.
 *
 * SUPER_ADMIN has no company of their own — `companyId` is null on that
 * account — so a plain `record.companyId !== me.companyId` locks them out of
 * every record in the system and reports it as "not found".
 */
export function canActOnCompany(
  me: { role: string; companyId: string | null },
  companyId: string | null,
): boolean {
  return me.role === "SUPER_ADMIN" || companyId === me.companyId;
}
