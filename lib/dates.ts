// Day boundaries in a shop's timezone (Shop.timezone, IANA name). Timestamps are stored in UTC.

/** "YYYY-MM-DD" of an instant, in the shop timezone. */
export function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Offset of `tz` from UTC at `date`, in minutes (e.g. +180 for Beirut in summer). */
function offsetMinutes(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** UTC instant of local midnight for "YYYY-MM-DD" in `tz`. */
export function startOfDay(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  // Two passes handle DST changes around midnight.
  let t = guess.getTime() - offsetMinutes(guess, tz) * 60000;
  t = guess.getTime() - offsetMinutes(new Date(t), tz) * 60000;
  return new Date(t);
}

/** "YYYY-MM-DD" plus `days`. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export type DayRange = { from: string; to: string; start: Date; end: Date; tz: string };

/**
 * Inclusive local-day range → [start, end) UTC instants.
 * Defaults to the current month so far. Capped at 366 days.
 */
export function dayRange(tz: string, from?: string, to?: string): DayRange {
  const today = dayKey(new Date(), tz);
  let f = isDayKey(from) ? from : `${today.slice(0, 8)}01`;
  let t = isDayKey(to) ? to : today;
  if (f > t) [f, t] = [t, f];
  if (startOfDay(t, tz).getTime() - startOfDay(f, tz).getTime() > 366 * 86_400_000) f = addDays(t, -366);
  return { from: f, to: t, start: startOfDay(f, tz), end: startOfDay(addDays(t, 1), tz), tz };
}

/** Every day key in the range, for charts with no gaps. */
export function daysIn(range: DayRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** True if `tz` is an IANA time zone name this runtime knows (validates Shop.timezone). */
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
