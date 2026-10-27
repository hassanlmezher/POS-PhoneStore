import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { listPrices } from "@/features/prices/queries";
import { getDeviceCatalog, listTechnicians } from "@/features/tickets/queries";
import { IntakeForm } from "@/features/tickets/ui/intake-form";
import { listPresets, presetLabel } from "@/features/settings/presets";
import { can } from "@/lib/permissions";
import { requirePermission } from "@/lib/tenant";

export default async function NewTicketPage({ params, searchParams }: PageProps<"/shop/[slug]/tickets/new">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { shop, user, db } = await requirePermission(slug, "tickets.create");
  const [t, locale] = await Promise.all([getTranslations("intake"), getLocale()]);
  const customerId = typeof sp.customer === "string" ? sp.customer : null;

  const [catalog, technicians, customer, problems, prices] = await Promise.all([
    getDeviceCatalog(shop.id),
    listTechnicians(shop.id),
    customerId ? db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true, locale: true } }) : null,
    listPresets(shop.id, "PROBLEM"),
    listPrices(shop.id),
  ]);
  // From a quick quote: ?model=<deviceModelId>&quote=<priceId,…>
  const quoteIds = typeof sp.quote === "string" ? sp.quote.split(",").slice(0, 20) : [];
  const initialQuote = prices.filter((p) => quoteIds.includes(p.id));
  const modelParam = typeof sp.model === "string" ? sp.model : null;
  const model = modelParam ? catalog.flatMap((b) => b.models.map((m) => ({ ...m, label: `${b.name} ${m.name}` }))).find((m) => m.id === modelParam) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <IntakeForm
        catalog={catalog}
        technicians={technicians}
        initialCustomer={customer}
        defaultAssigneeId={user.role === "TECHNICIAN" ? user.id : ""}
        defaultWarrantyDays={shop.defaultWarrantyDays}
        defaultLocale={shop.defaultLocale}
        rate={shop.exchangeRate}
        rounding={shop.lbpRounding}
        ticketPrefix={shop.ticketPrefix}
        problems={problems.map((p) => ({ id: p.id, label: presetLabel(p, locale) }))}
        canEditProblems={can(user.role, "settings")}
        prices={prices}
        initialDevice={model ? { kind: "model", id: model.id, label: model.label } : undefined}
        initialQuote={initialQuote}
      />
    </div>
  );
}
