/** The check message is due this many days after pickup. */
export const CHECK_AFTER_DAYS = 3;
/** The check is only offered for phones picked up in the last N days. */
export const FOLLOWUP_WINDOW_DAYS = 30;

export const daysSince = (d: Date, now = new Date()) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
