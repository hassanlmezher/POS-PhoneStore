import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { cn } from "@/lib/utils";

export type DashboardTicket = {
  id: string;
  number: number;
  status: TicketStatus;
  device: string;
  promisedAt: Date | null;
  balanceUsdCents: number;
  customer: { name: string };
  /** Pre-built wa.me link (ready list). */
  waUrl?: string | null;
};

/** Compact ticket rows for dashboard cards: label, device, customer, due/overdue, balance, quick actions. */
export function TicketList({
  tickets,
  prefix,
  showBalance,
  showStatus,
  overdue,
}: {
  tickets: DashboardTicket[];
  prefix: string;
  showBalance?: boolean;
  showStatus?: boolean;
  /** Emphasise the promised date as overdue. */
  overdue?: boolean;
}) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const now = new Date();
  return (
    <ul className="divide-y">
      {tickets.map((tk) => (
        <li key={tk.id} className="relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <Link href={`/tickets/${tk.number}`} className="shrink-0 font-semibold whitespace-nowrap outline-none after:absolute after:inset-0 focus-visible:underline">
                <Ltr>{formatTicketNumber(prefix, tk.number)}</Ltr>
              </Link>
              <span className="truncate font-medium">{tk.device || "—"}</span>
              {showStatus && <StatusBadge status={tk.status} className="hidden sm:inline-flex" />}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {tk.customer.name}
              {tk.promisedAt && (
                <span className={cn(overdue && "font-medium text-destructive")}>
                  {" · "}
                  {overdue ? t("overdueBy", { time: format.relativeTime(tk.promisedAt, now) }) : t("promised", { time: format.relativeTime(tk.promisedAt, now) })}
                </span>
              )}
            </p>
          </div>
          {showBalance && (
            <span className="text-end text-sm">
              {tk.balanceUsdCents > 0 ? (
                <Ltr className="font-semibold text-warning">{formatMoney(tk.balanceUsdCents, "USD")}</Ltr>
              ) : (
                <span className="text-success">{t("paid")}</span>
              )}
            </span>
          )}
          {tk.waUrl ? (
            <Button variant="outline" size="icon" asChild className="relative z-10">
              <a href={tk.waUrl} target="_blank" rel="noopener noreferrer" aria-label={t("notifyCustomer", { name: tk.customer.name })} title={t("notifyCustomer", { name: tk.customer.name })}>
                <MessageCircle className="text-success" />
              </a>
            </Button>
          ) : (
            <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground rtl:rotate-180" />
          )}
        </li>
      ))}
    </ul>
  );
}
