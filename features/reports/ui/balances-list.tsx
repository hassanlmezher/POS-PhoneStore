"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

/** Compact row data: rendering here (not in the server section) keeps the page payload much smaller per customer. */
export type BalanceListRow = {
  customerId: string;
  name: string;
  phone: string;
  owedUsdCents: number;
  dueOnPickupUsdCents: number;
  tickets: { id: string; number: number; label: string; status: string; balanceUsdCents: number }[];
  sales: { id: string; number: number; balanceUsdCents: number }[];
};

const chip = "inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-sm whitespace-nowrap transition-colors hover:bg-accent";

export function BalancesList({ rows, canRemind, rate, rounding }: { rows: BalanceListRow[]; canRemind: boolean; rate: number; rounding: number }) {
  const t = useTranslations("reports");
  const money = (c: number, usdClassName?: string) => <Money usdCents={c} rate={rate} rounding={rounding} usdClassName={usdClassName} lbpClassName="text-xs" />;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.customerId} className="flex flex-col gap-3 px-4 py-4 sm:px-6 xl:flex-row xl:items-center">
          <div className="min-w-0 xl:w-56 xl:shrink-0">
            <Link href={`/customers/${r.customerId}`} className="font-medium hover:underline focus-visible:underline">
              {r.name}
            </Link>
            <p className="text-sm text-muted-foreground">
              <Ltr>{r.phone}</Ltr>
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {r.tickets.map((x) => (
              <Link key={x.id} href={`/tickets/${x.number}`} className={chip}>
                <Ltr className="font-medium">{x.label}</Ltr>
                <StatusBadge status={x.status as TicketStatus} />
                <Ltr className="text-muted-foreground">{formatMoney(x.balanceUsdCents, "USD")}</Ltr>
              </Link>
            ))}
            {r.sales.map((s) => (
              <Link key={s.id} href={`/sales/${s.number}`} className={chip}>
                <span className="font-medium">
                  {t("sale")} <Ltr>#{s.number}</Ltr>
                </span>
                <Ltr className="text-muted-foreground">{formatMoney(s.balanceUsdCents, "USD")}</Ltr>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 xl:shrink-0 xl:justify-end">
            <dl className="flex gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">{t("owedNow")}</dt>
                <dd>{money(r.owedUsdCents, r.owedUsdCents > 0 ? "text-warning" : "text-subtle-foreground")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("dueOnPickup")}</dt>
                <dd>{money(r.dueOnPickupUsdCents)}</dd>
              </div>
            </dl>
            {canRemind && (
              <Button variant="outline" size="icon" asChild>
                {/* Built on click by /reports/remind (a long prefilled wa.me link per row made the page heavy). */}
                <a
                  href={`/reports/remind/${r.customerId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("sendReminder", { name: r.name })}
                  title={t("sendReminder", { name: r.name })}
                >
                  <MessageCircle className="text-success" />
                </a>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
