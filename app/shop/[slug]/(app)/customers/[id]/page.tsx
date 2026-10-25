import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Clock, MessageCircle, Pencil, Phone, Plus, ShoppingBag, Wallet, Wrench } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { StatTile } from "@/components/stat-tile";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCustomer } from "@/features/customers/queries";
import { CustomerDialogButton } from "@/features/customers/ui/customer-dialog";
import { warrantyUntil } from "@/features/tickets/money";
import { deviceName } from "@/features/tickets/queries";
import { WarrantyBadge } from "@/features/tickets/ui/warranty-badge";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { formatPhone, waNumber } from "@/lib/phone";
import { requireShop } from "@/lib/tenant";

export default async function CustomerPage({ params }: PageProps<"/shop/[slug]/customers/[id]">) {
  const { slug, id } = await params;
  const { db, shop, user, readOnly } = await requireShop(slug);
  const customer = await getCustomer(db, id);
  if (!customer) notFound();
  const t = await getTranslations("customers");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const canCreate = can(user.role, "tickets.create") && !readOnly;
  const canEdit = can(user.role, "customers.edit") && !readOnly;
  const rate = shop.exchangeRate;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={tc("breadcrumb")}>
        <Link href="/customers" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronRight aria-hidden className="size-4 rotate-180 rtl:rotate-0" />
          {t("title")}
        </Link>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <Badge variant="outline">{customer.locale === "AR" ? tc("arabic") : tc("english")}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href={`tel:${customer.phone}`} className="inline-flex min-h-11 items-center gap-1.5 text-foreground hover:text-primary">
              <Phone aria-hidden className="size-4 text-muted-foreground" />
              <Ltr>{formatPhone(customer.phone, shop.countryCode)}</Ltr>
            </a>
            <a
              href={`https://wa.me/${waNumber(customer.phone)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-1.5 text-foreground hover:text-primary"
            >
              <MessageCircle aria-hidden className="size-4 text-success" />
              {t("whatsappChat")}
            </a>
          </div>
          {customer.notes && <p className="max-w-prose text-sm whitespace-pre-line text-muted-foreground">{customer.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canEdit && (
            <CustomerDialogButton
              variant="outline"
              customer={{ id: customer.id, name: customer.name, phone: customer.phone, locale: customer.locale, notes: customer.notes }}
            >
              <Pencil />
              {tc("edit")}
            </CustomerDialogButton>
          )}
          {canCreate && (
            <Button asChild>
              <Link href={`/tickets/new?customer=${customer.id}`}>
                <Plus />
                {tc("newTicket")}
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section aria-label={t("overview")} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile icon={Wrench} label={t("repairs")}>
          {customer.tickets.length}
        </StatTile>
        <StatTile icon={Wallet} label={t("owed")} tone={customer.owedUsdCents > 0 ? "warning" : "default"}>
          <Money usdCents={customer.owedUsdCents} rate={rate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
        <StatTile icon={Clock} label={t("dueOnPickup")}>
          <Money usdCents={customer.dueOnPickupUsdCents} rate={rate} rounding={shop.lbpRounding} lbpClassName="text-sm" />
        </StatTile>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card" aria-labelledby="repairs-h">
        <div className="border-b px-4 py-4 sm:px-6">
          <h2 id="repairs-h" className="font-semibold">
            {t("repairHistory")}
          </h2>
        </div>
        {customer.tickets.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t("noRepairs")}
            body={t("noRepairsBody")}
            action={
              canCreate && (
                <Button asChild>
                  <Link href={`/tickets/new?customer=${customer.id}`}>
                    <Plus />
                    {tc("newTicket")}
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y">
            {customer.tickets.map((tk) => {
              const label = formatTicketNumber(shop.ticketPrefix, tk.number);
              return (
                <li key={tk.id}>
                  <Link
                    href={`/tickets/${tk.number}`}
                    className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Ltr className="w-20 shrink-0 font-semibold">{label}</Ltr>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{deviceName(tk)}</p>
                        <p className="truncate text-xs text-muted-foreground">{tk.problem}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <StatusBadge status={tk.status} />
                      <WarrantyBadge until={warrantyUntil(tk)} />
                      <span className="text-xs text-muted-foreground">{format.dateTime(tk.createdAt, { dateStyle: "medium" })}</span>
                      {tk.balanceUsdCents > 0 && (
                        <Money usdCents={tk.balanceUsdCents} rate={rate} rounding={shop.lbpRounding} layout="inline" className="text-sm" usdClassName="text-warning" />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-card" aria-labelledby="sales-h">
        <div className="border-b px-4 py-4 sm:px-6">
          <h2 id="sales-h" className="font-semibold">
            {t("purchases")}
          </h2>
        </div>
        {customer.sales.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={t("noPurchases")} body={t("noPurchasesBody")} />
        ) : (
          <ul className="divide-y">
            {customer.sales.map((s) => {
              const voided = s.status === "VOIDED";
              return (
                <li key={s.id}>
                  <Link
                    href={`/sales/${s.number}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
                  >
                    <Ltr className="w-20 shrink-0 font-semibold">#{s.number}</Ltr>
                    <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                      {format.dateTime(s.createdAt, { dateStyle: "medium" })} · {t("itemsCount", { count: s._count.items })}
                    </span>
                    <span className="flex items-center gap-2">
                      {voided && <Badge variant="destructive">{t("voided")}</Badge>}
                      {s.balanceUsdCents > 0 && (
                        <Badge variant="warning">
                          {t("saleBalance")} <Ltr>{formatMoney(s.balanceUsdCents, "USD")}</Ltr>
                        </Badge>
                      )}
                      <Money
                        usdCents={s.totalUsdCents}
                        rate={rate}
                        rounding={shop.lbpRounding}
                        layout="inline"
                        className={voided ? "text-sm line-through opacity-60" : "text-sm"}
                      />
                      <ChevronRight aria-hidden className="size-4 text-subtle-foreground rtl:rotate-180" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
