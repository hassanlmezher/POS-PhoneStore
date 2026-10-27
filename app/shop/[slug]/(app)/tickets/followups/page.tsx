import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { checkWhatsApp, reviewWhatsApp } from "@/features/followups/message";
import { listFollowups, type FollowupTicket } from "@/features/followups/queries";
import { FollowupList, type FollowupRow } from "@/features/followups/ui/followup-list";
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
  const [t, lists] = await Promise.all([getTranslations("followups"), listFollowups(ctx)]);
  const isOwner = can(user.role, "settings");

  const toRow = async (r: FollowupTicket, kind: "review" | "check"): Promise<FollowupRow> => ({
    id: r.id,
    number: r.number,
    label: formatTicketNumber(shop.ticketPrefix, r.number),
    device: r.device,
    customer: r.customer.name,
    days: r.days,
    waUrl: !r.customer.phone ? null : kind === "review" ? await reviewWhatsApp(shop, r) : await checkWhatsApp(shop, r),
  });
  const [review, check] = await Promise.all([
    Promise.all(lists.review.map((r) => toRow(r, "review"))),
    Promise.all(lists.check.map((r) => toRow(r, "check"))),
  ]);

  const reviewMissing = !shop.googleReviewUrl && (
    <p role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
      {isOwner ? (
        <>
          {t("noLinkOwner")}{" "}
          <Link href="/settings#review-link" className="font-medium underline underline-offset-4">
            {t("addLink")}
          </Link>
        </>
      ) : (
        t("noLinkStaff")
      )}
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          isOwner &&
          shop.googleReviewUrl && (
            <Button variant="outline" asChild>
              <Link href="/settings#review-link">
                <Settings />
                {t("linkSettings")}
              </Link>
            </Button>
          )
        }
      />
      <FollowupList review={review} check={check} canSend={can(user.role, "tickets.status") && !readOnly} reviewMissing={reviewMissing} />
    </div>
  );
}
