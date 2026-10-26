import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MessageCircle, Phone } from "lucide-react";
import { LanguageSwitch } from "@/components/app-shell/language-switch";
import { ShopMark } from "@/components/app-shell/shop-mark";
import { Ltr } from "@/components/ltr";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { ApprovalAnswer } from "@/features/approvals/ui/approval-answer";
import { deviceName } from "@/features/tickets/queries";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatTicketNumber } from "@/lib/numbering";
import { formatPhone, normalizePhone, waNumber } from "@/lib/phone";
import { getShopBySlug } from "@/lib/tenant";

// Public page (no login) opened from the WhatsApp link. The token is long and random; it only shows
// the ticket label, device, reason and price, never the customer's details.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("approval");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function ApprovePage({ params }: PageProps<"/shop/[slug]/approve/[token]">) {
  const { slug, token } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();
  const approval = token.length <= 64
    ? await prisma.priceApproval.findFirst({
        where: { token, shopId: shop.id },
        select: {
          status: true,
          amountUsdCents: true,
          previousUsdCents: true,
          reason: true,
          ticket: {
            select: {
              number: true,
              brandText: true,
              modelText: true,
              deviceModel: { select: { name: true, brand: { select: { name: true } } } },
            },
          },
        },
      })
    : null;
  const t = await getTranslations("approval");
  const e164 = shop.phone ? normalizePhone(shop.phone, shop.countryCode) : null;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-3 px-4">
          <ShopMark name={shop.name} logoUrl={shop.logoUrl} className="size-10" />
          <p className="min-w-0 flex-1 truncate font-semibold">{shop.name}</p>
          <LanguageSwitch />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
        {!approval ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("notFound")}</p>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("pageSubtitle", { shop: shop.name })}</p>
            </div>

            <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("ticketLabel", { ticket: "" })}
                  <Ltr className="font-medium text-foreground">{formatTicketNumber(shop.ticketPrefix, approval.ticket.number)}</Ltr>
                </p>
                <p dir="auto" className="text-lg font-medium rtl:text-right">
                  {deviceName(approval.ticket)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("whyLabel")}</p>
                <p dir="auto" className="whitespace-pre-line rtl:text-right">
                  {approval.reason}
                </p>
              </div>
              <div className="rounded-lg bg-muted/60 p-4">
                <p className="text-sm text-muted-foreground">{t("priceLabel")}</p>
                <Money usdCents={approval.amountUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} className="text-3xl font-semibold" />
                {approval.previousUsdCents !== null && approval.previousUsdCents !== approval.amountUsdCents && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("previousLabel", { price: "" })}
                    <Ltr>{formatMoney(approval.previousUsdCents, "USD")}</Ltr>
                  </p>
                )}
              </div>
              <ApprovalAnswer token={token} initial={approval.status} />
            </section>
          </>
        )}

        {e164 && (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
            <h2 className="text-sm font-semibold">{t("questions")}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button asChild variant="outline">
                <a href={`https://wa.me/${waNumber(e164)}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle />
                  {t("whatsapp")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`tel:${e164}`}>
                  <Phone />
                  {t("call")} <Ltr>{formatPhone(e164, shop.countryCode)}</Ltr>
                </a>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
