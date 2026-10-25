import { useTranslations } from "next-intl";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { externalProps } from "@/features/marketing/contact";
import type { ShowcaseData } from "@/features/marketing/showcase";
import { cn } from "@/lib/utils";
import { Container } from "./section-heading";
import { ProductMock, hasProductMock } from "./product-mock";

export function Hero({ demo, showcase }: { demo: string | null; showcase: ShowcaseData | null }) {
  const t = useTranslations("marketing.hero");
  const preview = hasProductMock(showcase) ? showcase : null;
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <Container className={cn("grid items-center gap-14 py-14 sm:py-20 lg:gap-16 lg:py-24", preview && "lg:grid-cols-[1fr_1.05fr]")}>
        <div className="max-w-xl">
          <p className="inline-flex h-8 items-center rounded-full border bg-card px-3 text-sm font-medium text-muted-foreground shadow-card">
            {t("eyebrow")}
          </p>
          <h1
            id="hero-title"
            className="mt-5 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
          >
            {t("title")}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {demo && (
              <Button asChild size="lg">
                <a href={demo} {...externalProps(demo)}>
                  <MessageCircle aria-hidden className="size-5" />
                  {t("primary")}
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant={demo ? "outline" : "default"}>
              <a href="#pricing">
                {t("secondary")}
                <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
              </a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {(["trial", "noCard", "arabic"] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-2">
                <Check aria-hidden className="size-4 text-success" />
                {t(`points.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        {preview && (
          <div className="px-2 pt-4 sm:px-6 lg:px-0">
            <ProductMock showcase={preview} />
          </div>
        )}
      </Container>
    </section>
  );
}
