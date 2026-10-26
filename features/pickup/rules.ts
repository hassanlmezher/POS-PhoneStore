// Pickup rules for phones that are Ready but not collected (pure; safe for server and client).

/** Days after Ready when a reminder is due: 1st, 2nd, last. */
export const PICKUP_STAGES = [3, 14, 30] as const;

export function daysWaiting(readyAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - readyAt.getTime()) / 86_400_000));
}

/** How many reminders should have gone out by now (0–3). */
export function dueStage(days: number): number {
  return PICKUP_STAGES.filter((d) => days >= d).length;
}

/** Storage fee owed so far: the daily fee for every day past the free days. 0 when the shop has no fee. */
export function storageFee(days: number, freeDays: number, feePerDayUsdCents: number): number {
  if (feePerDayUsdCents <= 0 || days <= freeDays) return 0;
  return (days - freeDays) * feePerDayUsdCents;
}
