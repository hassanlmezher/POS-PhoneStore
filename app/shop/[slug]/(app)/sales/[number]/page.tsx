import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Ban, ChevronLeft, Printer, UserRound } from "lucide-react";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSaleByNumber } from "@/features/pos/queries";
import { VoidSaleButton } from "@/features/pos/ui/void-sale-button";
import { formatMoney, toLbp } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { requirePermission } from "@/lib/tenant";
import { cn } from "@/lib/utils";

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-card",
        className,
      )}
    >
      <header className="flex min-h-14 items-center border-b px-4 py-3 sm:px-6">
        <h2 className="font-semibold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export default async function SalePage({
  params,
}: PageProps<"/shop/[slug]/sales/[number]">) {
  const { slug, number: raw } = await params;
  const number = Number(raw.replace(/^#/, ""));
  if (!Number.isInteger(number) || number <= 0) notFound();
  const { db, shop, user, readOnly } = await requirePermission(slug, "pos");
  const sale = await getSaleByNumber(db, number);
  if (!sale) notFound();
  const voided = sale.status === "VOIDED";
  const [t, tm, format, voidLog] = await Promise.all([
    getTranslations("sales"),
    getTranslations("paymentMethods"),
    getFormatter(),
    voided
      ? db.auditLog.findFirst({
          where: { entity: "Sale", entityId: sale.id, action: "sale.void" },
          select: {
            createdAt: true,
            meta: true,
            user: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : null,
  ]);
  const rate = sale.payments[0]?.rate ?? shop.exchangeRate;
  const rounding = shop.lbpRounding;
  const canVoid = can(user.role, "sales.void") && !voided && !readOnly;
  const dt = (d: Date) =>
    format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const voidReason = (voidLog?.meta as { reason?: string } | null)?.reason;

  return (
    <div className="flex flex-col gap-6">
      <nav>
        <Link
          href="/sales"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {t("title")}
        </Link>
      </nav>

      {voided && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive-soft px-4 py-3 text-destructive"
        >
          <Ban className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">{t("voidedBanner")}</p>
            {voidLog && (
              <p>
                {t("voidedBy", {
                  name: voidLog.user.name,
                  date: dt(voidLog.createdAt),
                })}
                {voidReason && <> · {voidReason}</>}
              </p>
            )}
          </div>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("saleTitle")} <Ltr>#{sale.number}</Ltr>
            </h1>
            {voided ? (
              <Badge variant="destructive">{t("voided")}</Badge>
            ) : (
              <Badge variant="success">{t("completed")}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {dt(sale.createdAt)} · {t("byCashier", { name: sale.cashier.name })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a
              href={`/print/sale/${sale.number}`}
              target="_blank"
              rel="noopener"
            >
              <Printer />
              {t("print")}
            </a>
          </Button>
          {canVoid && <VoidSaleButton saleId={sale.id} number={sale.number} />}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card title={t("items")} className={cn(voided && "opacity-75")}>
          <ul className="divide-y">
            {sale.items.map((i) => {
              const line = i.qty * i.unitPriceUsdCents - i.discountUsdCents;
              return (
                <li
                  key={i.id}
                  className="flex items-start gap-4 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {i.kind === "TICKET_BALANCE" && i.ticket ? (
                        <Link
                          href={`/tickets/${i.ticket.number}`}
                          className="hover:text-primary hover:underline"
                        >
                          {t("repairPayment")}{" "}
                          <Ltr>
                            {formatTicketNumber(
                              shop.ticketPrefix,
                              i.ticket.number,
                            )}
                          </Ltr>
                        </Link>
                      ) : i.productId ? (
                        <Link
                          href={`/inventory/${i.productId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {i.description}
                        </Link>
                      ) : (
                        i.description
                      )}
                    </p>
                    {i.kind === "TICKET_BALANCE" && (
                      <p className="text-xs text-muted-foreground">
                        {i.description}
                      </p>
                    )}
                    {i.kind === "PRODUCT" && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        <Ltr>
                          {i.qty} × {formatMoney(i.unitPriceUsdCents, "USD")}
                        </Ltr>
                        {i.discountUsdCents > 0 && (
                          <span className="text-success">
                            {" · "}
                            {t("lineDiscount", {
                              amount: formatMoney(i.discountUsdCents, "USD"),
                            })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <Ltr className="font-semibold">
                    {formatMoney(line, "USD")}
                  </Ltr>
                </li>
              );
            })}
          </ul>
          <dl className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-4 text-sm sm:px-6">
            <div className="flex justify-between gap-3 text-muted-foreground">
              <dt>{t("subtotal")}</dt>
              <dd>
                <Ltr>{formatMoney(sale.subtotalUsdCents, "USD")}</Ltr>
              </dd>
            </div>
            {sale.discountUsdCents > 0 && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>{t("discount")}</dt>
                <dd>
                  <Ltr>−{formatMoney(sale.discountUsdCents, "USD")}</Ltr>
                </dd>
              </div>
            )}
            <div className="flex items-start justify-between gap-3 border-t pt-3">
              <dt className="pt-1 font-medium">{t("total")}</dt>
              <dd>
                <Money
                  usdCents={sale.totalUsdCents}
                  rate={rate}
                  rounding={rounding}
                  className="items-end text-xl rtl:items-start"
                  lbpClassName="text-sm"
                />
              </dd>
            </div>
            <p className="text-end text-xs text-subtle-foreground">
              {t("rateUsed")} <Ltr>{rate.toLocaleString("en-US")}</Ltr>
            </p>
          </dl>
        </Card>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card title={t("payments")}>
            <div className="flex flex-col gap-3 p-4 sm:p-6">
              {sale.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noPayments")}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {sale.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{tm(p.method)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.currency === "LBP" ? (
                            <>
                              ≈{" "}
                              <Ltr>
                                {formatMoney(p.usdCentsEquivalent, "USD")}
                              </Ltr>
                            </>
                          ) : (
                            <Ltr>
                              {formatMoney(
                                toLbp(p.amount, p.rate, rounding),
                                "LBP",
                              )}
                            </Ltr>
                          )}
                          {p.reference && (
                            <>
                              {" · "}
                              <Ltr>{p.reference}</Ltr>
                            </>
                          )}
                        </p>
                      </div>
                      <Ltr className="font-semibold whitespace-nowrap">
                        {formatMoney(p.amount, p.currency)}
                      </Ltr>
                    </li>
                  ))}
                </ul>
              )}
              {sale.changeAmount > 0 && sale.changeCurrency && (
                <div className="flex justify-between gap-3 border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {t("changeGiven")}
                  </span>
                  <Ltr className="font-semibold">
                    {formatMoney(sale.changeAmount, sale.changeCurrency)}
                  </Ltr>
                </div>
              )}
              {!voided && (
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <span className="font-medium">{t("balance")}</span>
                  {sale.balanceUsdCents > 0 ? (
                    <Money
                      usdCents={sale.balanceUsdCents}
                      rate={rate}
                      rounding={rounding}
                      className="items-end rtl:items-start"
                      usdClassName="text-warning"
                    />
                  ) : (
                    <span className="text-sm font-medium text-success">
                      {t("paidInFull")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card title={t("customer")}>
            <div className="p-4 sm:p-6">
              {sale.customer ? (
                <Link
                  href={`/customers/${sale.customer.id}`}
                  className="-m-2 flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {sale.customer.name}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      <Ltr>{formatPhone(sale.customer.phone, shop.countryCode)}</Ltr>
                    </span>
                  </span>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">{t("walkIn")}</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
