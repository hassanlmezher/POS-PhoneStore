import { getTranslations } from "next-intl/server";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { externalProps } from "@/features/marketing/contact";
import { Container, SectionHeading } from "./section-heading";

export type PublicPlan = { id: string; name: string; priceUsdCents: number; maxStaff: number | null };

const INCLUDES = ["tickets", "pos", "currency", "whatsapp"] as const;

export async function Pricing({ plans, demo }: { plans: PublicPlan[]; demo: string | null }) {
  const t = await getTranslations("marketing.pricing");
  const cta = demo ?? "#contact";
  const popular = plans.length >= 3 ? 1 : -1;

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 py-16 sm:py-24">
      <Container>
        <SectionHeading id="pricing-title" eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        {plans.length === 0 ? (
          <div className="mx-auto mt-12 max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MessageCircle aria-hidden className="size-6" />
            </span>
            <h3 className="mt-5 text-xl font-semibold">{t("contactTitle")}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{t("contactBody")}</p>
            <Badge variant="success" className="mt-5 h-7 px-3 text-sm">
              {t("trial")}
            </Badge>
            <Button asChild size="lg" className="mt-6 w-full">
              <a href={cta} {...externalProps(cta)}>
                {t("contactCta")}
              </a>
            </Button>
          </div>
        ) : (
          <ul
            className={cn(
              "mx-auto mt-12 grid grid-cols-1 gap-4 sm:gap-6",
              plans.length === 1 && "max-w-md",
              plans.length === 2 && "max-w-3xl sm:grid-cols-2",
              plans.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {plans.map((p, i) => {
              const hot = i === popular;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border bg-card p-6 shadow-card sm:p-8",
                    hot && "border-primary shadow-pop ring-1 ring-primary",
                  )}
                >
                  {hot && (
                    <Badge className="absolute -top-3 start-6 h-6 gap-1 px-2.5">
                      <Sparkles aria-hidden className="size-3.5" />
                      {t("popular")}
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <bdi dir="ltr" className="text-4xl font-semibold tracking-tight tabular-nums">
                      {formatMoney(p.priceUsdCents, "USD")}
                    </bdi>
                    <span className="text-muted-foreground">{t("perMonth")}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {p.maxStaff ? t("staff", { count: p.maxStaff }) : t("unlimitedStaff")}
                  </p>
                  <Badge variant="success" className="mt-4 h-7 px-3 text-sm">
                    {t("trial")}
                  </Badge>
                  <p className="mt-6 text-sm font-medium">{t("everything")}</p>
                  <ul className="mt-3 flex-1 space-y-2.5 text-sm">
                    {INCLUDES.map((k) => (
                      <li key={k} className="flex gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                        {t(`includes.${k}`)}
                      </li>
                    ))}
                  </ul>
                  <Button asChild size="lg" variant={hot ? "default" : "outline"} className="mt-8 w-full">
                    <a href={cta} {...externalProps(cta)}>
                      {t("start")}
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </section>
  );
}
