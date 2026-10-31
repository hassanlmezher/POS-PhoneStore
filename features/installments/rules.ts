import { z } from "zod";
import { addDays, isDayKey } from "@/lib/dates";

export const EVERY = ["WEEK", "TWO_WEEKS", "MONTH"] as const;
export type Every = (typeof EVERY)[number];
export const MIN_PARTS = 2;
export const MAX_PARTS = 12;
/** A part shows up in "due soon" this many days before its day. */
export const DUE_SOON_DAYS = 3;

export const planInput = z.object({
  kind: z.enum(["sale", "ticket"]),
  id: z.string().min(1).max(64),
  parts: z.coerce.number().int().min(MIN_PARTS, "invalidParts").max(MAX_PARTS, "invalidParts"),
  every: z.enum(EVERY),
  firstDay: z.string().refine(isDayKey, "invalidDate"),
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});
export type PlanInput = z.input<typeof planInput>;

/** Equal parts in cents; the cents left over go on the first part so the total is exact. */
export function splitAmount(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => base + (i === 0 ? total - base * parts : 0));
}

/** "YYYY-MM-DD" plus `n` months, kept inside the month (Jan 31 + 1 month → Feb 28/29). */
function addMonths(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Due days of every part, starting on `first`. */
export function scheduleDays(first: string, parts: number, every: Every): string[] {
  return Array.from({ length: parts }, (_, i) => (every === "MONTH" ? addMonths(first, i) : addDays(first, i * (every === "WEEK" ? 7 : 14))));
}

export type PartState = "paid" | "partial" | "late" | "today" | "dueSoon" | "later";

/**
 * Fills the parts in order with what was paid since the plan started.
 * `today` and the due days are "YYYY-MM-DD" in the shop timezone.
 */
export function partStates<T extends { dueDay: string; amountUsdCents: number }>(parts: T[], paidUsdCents: number, today: string) {
  let left = Math.max(0, paidUsdCents);
  const soon = addDays(today, DUE_SOON_DAYS);
  return parts.map((p) => {
    const paid = Math.min(left, p.amountUsdCents);
    left -= paid;
    const owed = p.amountUsdCents - paid;
    const state: PartState =
      owed <= 1 ? "paid" : p.dueDay < today ? "late" : p.dueDay === today ? "today" : p.dueDay <= soon ? "dueSoon" : paid > 0 ? "partial" : "later";
    return { ...p, paidUsdCents: paid, owedUsdCents: owed <= 1 ? 0 : owed, state };
  });
}
