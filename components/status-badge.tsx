import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const TICKET_STATUSES = [
  "RECEIVED",
  "DIAGNOSING",
  "WAITING_PART",
  "REPAIRING",
  "READY",
  "PICKED_UP",
  "CANCELLED",
  "CANT_FIX",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Full class strings so Tailwind picks them up. Colors come from the status tokens in globals.css.
const statusClasses: Record<TicketStatus, string> = {
  RECEIVED: "bg-status-received text-status-received-foreground",
  DIAGNOSING: "bg-status-diagnosing text-status-diagnosing-foreground",
  WAITING_PART: "bg-status-waiting-part text-status-waiting-part-foreground",
  REPAIRING: "bg-status-repairing text-status-repairing-foreground",
  READY: "bg-status-ready text-status-ready-foreground",
  PICKED_UP: "bg-status-picked-up text-status-picked-up-foreground",
  CANCELLED: "bg-status-cancelled text-status-cancelled-foreground",
  CANT_FIX: "bg-status-cant-fix text-status-cant-fix-foreground",
};

/** Ticket status pill. Works in server and client components. */
export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        statusClasses[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />
      {t(status)}
    </span>
  );
}
