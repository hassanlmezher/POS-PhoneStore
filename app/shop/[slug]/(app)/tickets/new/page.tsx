import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
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

  const [catalog, technicians, customer, problems] = await Promise.all([
    getDeviceCatalog(shop.id),
    listTechnicians(shop.id),
    customerId ? db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true, locale: true } }) : null,
    listPresets(shop.id, "PROBLEM"),
  ]);

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
      />
    </div>
  );
}
