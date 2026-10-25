import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Plus, Receipt, SearchX } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrlSearchInput } from "@/components/url-search-input";
import { listSales } from "@/features/pos/queries";
import { formatMoney } from "@/lib/money";
import { requirePermission } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export default async function SalesPage({ params, searchParams }: PageProps<"/shop/[slug]/sales">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { db, shop, readOnly } = await requirePermission(slug, "pos");
  const [t, tm, format] = await Promise.all([getTranslations("sales"), getTranslations("paymentMethods"), getFormatter()]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listSales(db, { q, page });
  const rate = shop.exchangeRate;
  const rounding = shop.lbpRounding;
  const methods = (ps: { method: string }[]) => [...new Set(ps.map((p) => p.method))].map((m) => tm(m as never)).join(", ");

  const newSale = !readOnly && (
    <Button asChild>
      <Link href="/pos">
        <Plus />
        {t("newSale")}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle", { count: total })} actions={newSale} />

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b p-3 sm:p-4">
          <UrlSearchInput basePath="/sales" label={t("search")} placeholder={t("searchPlaceholder")} className="sm:max-w-sm" />
        </div>

        {rows.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title={t("noResults")} body={t("noResultsBody", { q })} />
          ) : (
            <EmptyState icon={Receipt} title={t("emptyTitle")} body={t("emptyBody")} action={newSale} />
          )
        ) : (
          <>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">#</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead className="hidden text-end xl:table-cell">{t("items")}</TableHead>
                  <TableHead className="text-end">{t("total")}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t("payment")}</TableHead>
                  <TableHead className="text-end">{t("balance")}</TableHead>
                  <TableHead className="hidden 2xl:table-cell">{t("cashier")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const voided = s.status === "VOIDED";
                  return (
                    <TableRow key={s.id} className={cn("relative", voided && "text-muted-foreground")}>
                      <TableCell className="font-semibold">
                        <Link href={`/sales/${s.number}`} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                          <Ltr>#{s.number}</Ltr>
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{format.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                      <TableCell className="max-w-48 truncate">{s.customer?.name ?? <span className="text-subtle-foreground">{t("walkIn")}</span>}</TableCell>
                      <TableCell className="hidden text-end tabular-nums xl:table-cell">{s._count.items}</TableCell>
                      <TableCell className="text-end">
                        {voided ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge variant="destructive">{t("voided")}</Badge>
                            <Ltr className="line-through">{formatMoney(s.totalUsdCents, "USD")}</Ltr>
                          </span>
                        ) : (
                          <Money usdCents={s.totalUsdCents} rate={rate} rounding={rounding} className="items-end whitespace-nowrap rtl:items-start" />
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-40 truncate text-muted-foreground xl:table-cell">{s.payments.length ? methods(s.payments) : "—"}</TableCell>
                      <TableCell className="text-end">
                        {s.balanceUsdCents > 0 ? (
                          <Ltr className="font-medium text-warning">{formatMoney(s.balanceUsdCents, "USD")}</Ltr>
                        ) : (
                          <span className="text-subtle-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground 2xl:table-cell">{s.cashier.name}</TableCell>
                      <TableCell>
                        <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <ul className="divide-y md:hidden">
              {rows.map((s) => {
                const voided = s.status === "VOIDED";
                return (
                  <li key={s.id}>
                    <Link href={`/sales/${s.number}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium">
                          <Ltr>#{s.number}</Ltr>
                          <span className="truncate text-muted-foreground">{s.customer?.name ?? t("walkIn")}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{format.dateTime(s.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 rtl:items-start">
                        {voided ? (
                          <Badge variant="destructive">{t("voided")}</Badge>
                        ) : (
                          <Ltr className="font-semibold">{formatMoney(s.totalUsdCents, "USD")}</Ltr>
                        )}
                        {s.balanceUsdCents > 0 && <span className="text-xs text-warning">{t("owes", { amount: formatMoney(s.balanceUsdCents, "USD") })}</span>}
                      </div>
                      <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="border-t empty:hidden">
              <Pagination page={page} pageSize={pageSize} total={total} basePath="/sales" params={sp} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
