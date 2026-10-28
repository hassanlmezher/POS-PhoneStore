import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { checkWhatsApp } from "@/features/followups/message";
import { listChecksDue } from "@/features/followups/queries";
import { FollowupList } from "@/features/followups/ui/followup-list";
import { formatTicketNumber } from "@/lib/numbering";
import { can } from "@/lib/permissions";
import { requireShop } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("followups");
  return { title: t("title") };
}

export default async function FollowupsPage({ params }: PageProps<"/shop/[slug]/tickets/followups">) {
  const { slug } = await params;
  const ctx = await requireShop(slug);
  const { shop, user, readOnly } = ctx;
  const [t, due] = await Promise.all([getTranslations("followups"), listChecksDue(ctx)]);
  const rows = await Promise.all(
    due.map(async (r) => ({
      id: r.id,
      number: r.number,
      label: formatTicketNumber(shop.ticketPrefix, r.number),
      device: r.device,
      customer: r.customer.name,
      days: r.days,
      waUrl: r.customer.phone ? await checkWhatsApp(shop, r) : null,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <FollowupList rows={rows} canSend={can(user.role, "tickets.status") && !readOnly} />
    </div>
  );
}
