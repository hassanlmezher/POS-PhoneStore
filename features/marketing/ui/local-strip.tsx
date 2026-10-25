import { useTranslations } from "next-intl";
import { Coins, Printer, TabletSmartphone, Wallet } from "lucide-react";
import { Container } from "./section-heading";

const ITEMS = [
  { key: "payments", icon: Wallet },
  { key: "currency", icon: Coins },
  { key: "printing", icon: Printer },
  { key: "tablet", icon: TabletSmartphone },
] as const;

export function LocalStrip() {
  const t = useTranslations("marketing.local");
  return (
    <section id="lebanon" aria-labelledby="local-title" className="scroll-mt-16 border-y bg-card py-16 sm:py-20">
      <Container>
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h2 id="local-title" className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li key={key} className="border-s-2 border-primary/20 ps-5">
              <Icon aria-hidden className="size-6 text-primary" />
              <h3 className="mt-4 font-semibold">{t(`${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
