/** The check message is due this many days after pickup. */
export const CHECK_AFTER_DAYS = 3;
/** Follow-ups are only offered for phones picked up in the last N days. */
export const FOLLOWUP_WINDOW_DAYS = 30;

export type FollowupKind = "review" | "check";

export const daysSince = (d: Date, now = new Date()) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
