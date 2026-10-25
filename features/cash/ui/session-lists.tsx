import { useFormatter, useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Movement = {
  id: string;
  type: "PAY_IN" | "PAY_OUT";
  currency: "USD" | "LBP";
  amount: number;
  reason: string;
  createdAt: Date;
  user: { name: string };
};

/** Pay-ins / pay-outs of a drawer session. */
export function MovementList({ movements }: { movements: Movement[] }) {
  const t = useTranslations("cash");
  const format = useFormatter();
  if (movements.length === 0) return <EmptyState title={t("noMovements")} body={t("noMovementsBody")} className="py-8" />;
  return (
    <ul className="divide-y">
      {movements.map((m) => {
        const isIn = m.type === "PAY_IN";
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                isIn ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
              )}
            >
              {isIn ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.reason}</p>
              <p className="text-xs text-muted-foreground">
                {t(isIn ? "payIn" : "payOut")} · {format.dateTime(m.createdAt, { timeStyle: "short" })} · {m.user.name}
              </p>
            </div>
            <bdi dir="ltr" className={cn("font-semibold tabular-nums", isIn ? "text-success" : "text-foreground")}>
              {isIn ? "+" : "−"}
              {formatMoney(m.amount, m.currency)}
            </bdi>
          </li>
        );
      })}
    </ul>
  );
}

/** Non-cash takings while the drawer was open (information only). */
export function OtherMethodsList({
  items,
  rate,
  rounding,
}: {
  items: { method: string; usdCents: number; count: number }[];
  rate: number;
  rounding?: number;
}) {
  const t = useTranslations("cash");
  const tm = useTranslations("paymentMethods");
  if (items.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">{t("noOtherMethods")}</p>;
  return (
    <ul className="divide-y">
      {items.map((o) => (
        <li key={o.method} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <span>
            <span className="font-medium">{tm(o.method as never)}</span>
            <span className="ms-2 text-xs text-muted-foreground">{t("payments", { count: o.count })}</span>
          </span>
          <Money usdCents={o.usdCents} rate={rate} rounding={rounding} layout="inline" />
        </li>
      ))}
    </ul>
  );
}
