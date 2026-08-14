/**
 * lib/period.ts
 *
 * The reporting period, expressed as a single string that survives a URL.
 *
 *   today                      the day that is running now
 *   week | week:2026-08-06     the ISO week (Mon–Sun) containing that date
 *   month | month:2026-08      that calendar month
 *   year | year:2026           that calendar year
 *   range:2026-08-01..2026-08-14   anything else
 *
 * The bare forms mean "the current one", so old links and defaults keep working.
 *
 * `periodKey` identifies the period for driver adjustments (bonuses, advances)
 * and MUST stay stable: existing rows are keyed "2026-08" for a month, "2026"
 * for a year, "2026-08-14" for a day and "2026-W33" for a week.
 */

export type PeriodUnit = "today" | "week" | "month" | "year" | "range";

export type PeriodRange = {
  from: Date;
  to: Date;
  label: string;
  periodKey: string;
  unit: PeriodUnit;
  /** True when the period is the one containing today — hides "next". */
  isCurrent: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Monday of the week containing `d`. */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay() || 7; // Sunday counts as 7, so weeks start Monday
  x.setDate(x.getDate() - day + 1);
  return x;
}

/** ISO-8601 week number — the same one printed on European payslips. */
function isoWeek(d: Date): { year: number; week: number } {
  const x = startOfDay(d);
  // Thursday decides which year an ISO week belongs to.
  x.setDate(x.getDate() + 4 - (x.getDay() || 7));
  const yearStart = new Date(x.getFullYear(), 0, 1);
  const week = Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: x.getFullYear(), week };
}

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
const fmtDayYear = (d: Date) =>
  d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export function getPeriodRange(period: string, now: Date = new Date()): PeriodRange {
  const [unit, arg] = (period ?? "").split(":");

  switch (unit) {
    case "today": {
      const from = startOfDay(now);
      return {
        from,
        to: endOfDay(now),
        label: fmtDayYear(from),
        periodKey: ymd(from),
        unit: "today",
        isCurrent: true,
      };
    }

    case "month": {
      const anchor = arg
        ? new Date(Number(arg.slice(0, 4)), Number(arg.slice(5, 7)) - 1, 1)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const from = startOfDay(anchor);
      const to = endOfDay(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
      return {
        from,
        to,
        label: from.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        periodKey: `${from.getFullYear()}-${pad(from.getMonth() + 1)}`,
        unit: "month",
        isCurrent:
          from.getFullYear() === now.getFullYear() &&
          from.getMonth() === now.getMonth(),
      };
    }

    case "year": {
      const year = arg ? Number(arg) : now.getFullYear();
      const from = startOfDay(new Date(year, 0, 1));
      const to = endOfDay(new Date(year, 11, 31));
      return {
        from,
        to,
        label: String(year),
        periodKey: String(year),
        unit: "year",
        isCurrent: year === now.getFullYear(),
      };
    }

    case "range": {
      const [rawFrom, rawTo] = (arg ?? "").split("..");
      const from = parseDate(rawFrom ?? "");
      const to = parseDate(rawTo ?? "");
      if (from && to && from <= to) {
        return {
          from: startOfDay(from),
          to: endOfDay(to),
          label: `${fmtDay(from)} – ${fmtDayYear(to)}`,
          periodKey: `${ymd(from)}..${ymd(to)}`,
          unit: "range",
          isCurrent: false,
        };
      }
      // Unreadable range — fall through to the current week rather than
      // reporting on a nonsensical span.
      return getPeriodRange("week", now);
    }

    case "week":
    default: {
      const anchor = (arg && parseDate(arg)) || now;
      const from = startOfWeek(anchor);
      const to = endOfDay(new Date(from.getTime() + 6 * 86400000));
      const { year, week } = isoWeek(from);
      return {
        from,
        to,
        label: `${fmtDay(from)} – ${fmtDayYear(to)}`,
        periodKey: `${year}-W${pad(week)}`,
        unit: "week",
        isCurrent: startOfWeek(now).getTime() === from.getTime(),
      };
    }
  }
}

/**
 * The same period one step earlier or later. Returns null when there is
 * nothing sensible to move to (a custom range has no neighbours, and there is
 * no point stepping past today).
 */
export function shiftPeriod(period: string, delta: number): string | null {
  const { from, unit, isCurrent } = getPeriodRange(period);
  if (unit === "range") return null;
  if (delta > 0 && isCurrent) return null;

  switch (unit) {
    case "today": {
      const d = new Date(from);
      d.setDate(d.getDate() + delta);
      // "today" only ever means today; a different day is a one-day range.
      return `range:${ymd(d)}..${ymd(d)}`;
    }
    case "week": {
      const d = new Date(from);
      d.setDate(d.getDate() + delta * 7);
      return `week:${ymd(d)}`;
    }
    case "month": {
      const d = new Date(from.getFullYear(), from.getMonth() + delta, 1);
      return `month:${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    }
    case "year":
      return `year:${from.getFullYear() + delta}`;
    default:
      return null;
  }
}
