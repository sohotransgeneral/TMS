/**
 * lib/extract-dates.ts
 *
 * Normalizes the pickup/delivery dates the AI returns from a rate confirmation.
 *
 * Two things go wrong without this:
 *  1. The model answers in whatever format the document used (6/15/26,
 *     "June 15", "15.06.2026") instead of ISO.
 *  2. Anything carrying a "Z" or an offset gets shifted a day backwards once the
 *     browser renders it in a US timezone.
 *
 * So every date is parsed here and re-emitted as a naive local datetime string,
 * "YYYY-MM-DDTHH:MM:SS", which is exactly what <input type="datetime-local">
 * expects. Unreadable values become null — a blank the dispatcher fills in is
 * better than a confidently wrong date.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Picks the year that lands nearest to today when the document omitted it. */
function inferYear(month: number, day: number, now: Date): number {
  const thisYear = now.getUTCFullYear();
  const candidates = [thisYear - 1, thisYear, thisYear + 1].filter((y) =>
    isRealDate(y, month, day),
  );
  let best = thisYear;
  let bestDiff = Infinity;
  for (const y of candidates) {
    // Loads are nearly always in the near future, so weigh past dates against.
    const diff = Date.UTC(y, month - 1, day) - now.getTime();
    const weighted = diff < 0 ? -diff * 3 : diff;
    if (weighted < bestDiff) {
      bestDiff = weighted;
      best = y;
    }
  }
  return best;
}

/** Parses an AI-returned date into "YYYY-MM-DDTHH:MM:SS", or null. */
export function normalizeExtractedDate(
  value: unknown,
  now: Date = new Date(),
): string | null {
  if (typeof value !== "string") return null;
  // Rate cons love a weekday prefix ("Mon 8/17", "Monday, 08/17/2026") — it
  // carries no information the date doesn't already have.
  const raw = value
    .trim()
    .replace(/^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s*/i, "")
    .trim();
  if (!raw) return null;

  let y: number | null = null;
  let mo: number | null = null;
  let d: number | null = null;
  let hh = 0;
  let mi = 0;

  // ISO-ish: 2026-06-15 / 2026-06-15T08:30:00 / 2026-06-15T08:30:00Z
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(raw);
  // Numeric: 6/15/2026, 06-15-26, 15.06.2026
  const numeric = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?:[T ,]+(\d{1,2}):(\d{2}))?/.exec(raw);
  // Spelled out: June 15, 2026 / Jun 15 — the (?!\d) stops "June 2026" from
  // being read as day 20.
  const named = /(?:^|\s)([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s*(\d{2,4}))?/.exec(raw);
  // Day first: 15 June 2026 — checked before `named` so it wins on that shape.
  const namedDayFirst = /(?:^|\s)(\d{1,2})(?!\d)(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?(?:,?\s*(\d{2,4}))?/.exec(raw);

  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
    hh = Number(iso[4] ?? 0);
    mi = Number(iso[5] ?? 0);
  } else if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    // US documents are month-first; only flip when month-first is impossible.
    if (a > 12 && b <= 12) {
      d = a;
      mo = b;
    } else {
      mo = a;
      d = b;
    }
    hh = Number(numeric[4] ?? 0);
    mi = Number(numeric[5] ?? 0);
    if (numeric[3]) {
      const yr = Number(numeric[3]);
      y = yr < 100 ? 2000 + yr : yr;
    }
  } else {
    const dayFirst = namedDayFirst != null;
    const match = namedDayFirst ?? named;
    if (!match) return null;
    const monthName = (dayFirst ? match[2] : match[1]).slice(0, 3).toLowerCase();
    mo = MONTHS[monthName] ?? null;
    d = Number(dayFirst ? match[1] : match[2]);
    if (match[3]) {
      const yr = Number(match[3]);
      y = yr < 100 ? 2000 + yr : yr;
    }
  }

  if (mo == null || d == null || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  if (y == null) y = inferYear(mo, d, now);
  if (!isRealDate(y, mo, d)) return null;
  if (hh > 23 || mi > 59) {
    hh = 0;
    mi = 0;
  }

  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mi)}:00`;
}
