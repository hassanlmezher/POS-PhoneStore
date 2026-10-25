import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, History, Pencil } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { stockState } from "@/components/stock-level";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProduct, listCategories } from "@/features/inventory/queries";
import { AdjustStockForm } from "@/features/inventory/ui/adjust-stock-form";
import { marginPercent } from "@/features/inventory/margin";
import { PrintLabelButton } from "@/features/inventory/ui/print-label-button";
import { ProductDialogButton } from "@/features/inventory/ui/product-dialog";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";
import { cn } from "@/lib/utils";

function Card({ title, children, className, flush }: { title: string; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-card", className)}>
      <header className="flex min-h-14 items-center border-b px-4 py-3 sm:px-6">
        <h2 className="font-semibold">{title}</h2>
      </header>
      <div className={cn(!flush && "p-4 sm:p-6")}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

const STATE_TONE = { out: "text-destructive", low: "text-warning", ok: "text-foreground" } as const;


// Notes written by the system (old rows stored English text); shown translated.
const SYSTEM_NOTES = new Set(["@removedFromTicket", "Removed from ticket"]);
export default async function ProductPage({ params }: PageProps<"/shop/[slug]/inventory/[id]">) {
  const { slug, id } = await params;
  const { db, shop, user, readOnly } = await requireShop(slug);
  const product = await getProduct(db, id);
  if (!product) notFound();
  const isOwner = can(user.role, "inventory.adjust");
  const canEdit = isOwner && !readOnly;
  const [t, ti, tt, tr, ts, format, categories] = await Promise.all([
    getTranslations("product"),
    getTranslations("inventory"),
    getTranslations("productTypes"),
    getTranslations("movementReasons"),
    getTranslations("stock"),
    getFormatter(),
    canEdit ? listCategories(db) : Promise.resolve([]),
  ]);
  const rate = shop.exchangeRate;
  const rounding = shop.lbpRounding;
  const margin = marginPercent(product.priceUsdCents, product.costUsdCents);
  const state = stockState(product.qty, product.lowStockThreshold);
  const dash = <span className="text-subtle-foreground">—</span>;

  return (
    <div className="flex flex-col gap-6">
      <nav>
        <Link href="/inventory" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {ti("title")}
        </Link>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{product.name}</h1>
            <Badge variant={product.type === "PART" ? "soft" : "secondary"}>{tt(product.type)}</Badge>
            {!product.active && <Badge variant="outline">{ti("archived")}</Badge>}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {product.sku && (
              <span>
                {ti("sku")}: <Ltr className="font-mono text-foreground">{product.sku}</Ltr>
              </span>
            )}
            {product.barcode && (
              <span>
                {ti("barcode")}: <Ltr className="font-mono text-foreground">{product.barcode}</Ltr>
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PrintLabelButton productId={product.id} />
          {canEdit && (
            <ProductDialogButton
              variant="outline"
              categories={categories}
              rate={rate}
              rounding={rounding}
              product={{
                id: product.id,
                type: product.type,
                name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                category: product.category,
                costUsdCents: product.costUsdCents,
                priceUsdCents: product.priceUsdCents,
                lowStockThreshold: product.lowStockThreshold,
                active: product.active,
                compatibleModels: product.compatibleModels,
              }}
            >
              <Pencil />
              {t("edit")}
            </ProductDialogButton>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title={t("details")}>
            <dl className="flex flex-col gap-3">
              <Row label={ti("price")}>
                <Money usdCents={product.priceUsdCents} rate={rate} rounding={rounding} layout="inline" />
              </Row>
              {isOwner && (
                <>
                  <Row label={ti("cost")}>
                    <Ltr>{formatMoney(product.costUsdCents, "USD")}</Ltr>
                  </Row>
                  <Row label={t("margin")}>
                    {margin === null ? (
                      dash
                    ) : (
                      <span className={cn("font-medium tabular-nums", margin < 0 ? "text-destructive" : "text-success")}>
                        <bdi dir="ltr">
                          {formatMoney(product.priceUsdCents - product.costUsdCents, "USD")} · {margin}%
                        </bdi>
                      </span>
                    )}
                  </Row>
                </>
              )}
              <Row label={ti("category")}>{product.category ?? dash}</Row>
              <Row label={ti("lowStockThreshold")}>
                <span className="tabular-nums">{product.lowStockThreshold}</span>
              </Row>
              {product.type === "PART" && (
                <Row label={ti("compatibleModels")}>
                  {product.compatibleModels.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {product.compatibleModels.map((m) => (
                        <Badge key={m.id} variant="secondary">
                          {m.brand.name} {m.name}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-subtle-foreground">{t("noModels")}</span>
                  )}
                </Row>
              )}
            </dl>
          </Card>

          <Card title={t("history")} flush>
            {product.stockMovements.length === 0 ? (
              <EmptyState icon={History} title={t("noHistory")} body={t("noHistoryBody")} />
            ) : (
              <>
                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t("date")}</TableHead>
                      <TableHead className="text-end">{t("change")}</TableHead>
                      <TableHead className="text-end">{t("qtyAfter")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead className="hidden 2xl:table-cell">{t("by")}</TableHead>
                      <TableHead>{t("link")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.stockMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{format.dateTime(m.createdAt, { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                        <TableCell className={cn("text-end font-semibold tabular-nums", m.delta > 0 ? "text-success" : "text-destructive")}>
                          <bdi dir="ltr">{m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}</bdi>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{m.qtyAfter}</TableCell>
                        <TableCell>
                          {tr(m.reason)}
                          {m.note && <span className="block max-w-56 truncate text-xs text-muted-foreground">{SYSTEM_NOTES.has(m.note) ? tr("removedFromTicket") : m.note}</span>}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">{m.user.name}</TableCell>
                        <TableCell>
                          <MovementLink sale={m.sale?.number} ticket={m.ticketItem?.ticket.number} prefix={shop.ticketPrefix} saleLabel={t("saleNumber")} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ul className="divide-y sm:hidden">
                  {product.stockMovements.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={cn("w-12 shrink-0 text-lg font-semibold tabular-nums", m.delta > 0 ? "text-success" : "text-destructive")}>
                        <bdi dir="ltr">{m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}</bdi>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {tr(m.reason)}{" "}
                          <MovementLink sale={m.sale?.number} ticket={m.ticketItem?.ticket.number} prefix={shop.ticketPrefix} saleLabel={t("saleNumber")} />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {format.dateTime(m.createdAt, { dateStyle: "medium", timeStyle: "short" })} · {m.user.name}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground tabular-nums">{t("after", { qty: m.qtyAfter })}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        <aside className="order-first flex min-w-0 flex-col gap-6 xl:sticky xl:top-20 xl:order-none xl:self-start">
          <Card title={t("stockCard")}>
            <div className="flex flex-col gap-5 md:max-xl:grid md:max-xl:grid-cols-[11rem_minmax(0,1fr)] md:max-xl:gap-8">
              <div className="flex items-end justify-between gap-3 md:max-xl:flex-col md:max-xl:items-start">
                <div>
                  <p className={cn("text-5xl font-semibold tracking-tight tabular-nums", STATE_TONE[state])}>
                    <bdi dir="ltr">{product.qty}</bdi>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("inStock")}</p>
                </div>
                {state !== "ok" && <Badge variant={state === "out" ? "destructive" : "warning"}>{ts(state === "out" ? "outLong" : "lowLong")}</Badge>}
              </div>
              {canEdit ? (
                <div className="border-t pt-5 md:max-xl:border-t-0 md:max-xl:border-s md:max-xl:ps-8 md:max-xl:pt-0">
                  <h3 className="mb-4 text-sm font-semibold">{t("adjustStock")}</h3>
                  <AdjustStockForm productId={product.id} qty={product.qty} />
                </div>
              ) : (
                <p className="border-t pt-4 text-xs text-muted-foreground md:max-xl:border-t-0 md:max-xl:pt-0">{t("viewOnly")}</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MovementLink({ sale, ticket, prefix, saleLabel }: { sale?: number; ticket?: number; prefix: string; saleLabel: string }) {
  if (sale)
    return (
      <Link href={`/sales/${sale}`} className="inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-primary hover:underline sm:min-h-0">
        <Ltr>
          {saleLabel}
          {sale}
        </Ltr>
      </Link>
    );
  if (ticket)
    return (
      <Link href={`/tickets/${ticket}`} className="inline-flex min-h-11 items-center text-sm font-medium whitespace-nowrap text-primary hover:underline sm:min-h-0">
        <Ltr>{formatTicketNumber(prefix, ticket)}</Ltr>
      </Link>
    );
  return <span className="text-subtle-foreground">—</span>;
}
