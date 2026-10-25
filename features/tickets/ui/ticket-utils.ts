import { CLOSED_STATUSES, type TicketStatusValue } from "@/features/tickets/schema";

export function isClosed(status: TicketStatusValue) {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

/** Promised date passed and the phone is still in the shop. */
export function isOverdue(promisedAt: Date | null, status: TicketStatusValue, now = Date.now()) {
  return !!promisedAt && !isClosed(status) && status !== "READY" && promisedAt.getTime() < now;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/** The usual next step for the main status button. */
export const NEXT_STATUS: Partial<Record<TicketStatusValue, TicketStatusValue>> = {
  RECEIVED: "DIAGNOSING",
  DIAGNOSING: "REPAIRING",
  WAITING_PART: "REPAIRING",
  REPAIRING: "READY",
  READY: "PICKED_UP",
};
