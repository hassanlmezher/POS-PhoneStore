import { useFormatter, useTranslations } from "next-intl";
import {
  Boxes,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Languages,
  QrCode,
  ScanBarcode,
  UsersRound,
  Vault,
  type LucideIcon,
} from "lucide-react";
import { Money } from "@/components/money";
import { StatusBadge, type TicketStatus } from "@/components/status-badge";
import { Ltr } from "@/components/ltr";
import type { ShowcaseData } from "@/features/marketing/showcase";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Container, SectionHeading } from "./section-heading";
import { TicketCardMock } from "./product-mock";

function TimeChip({ time }: { time: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-xs font-semibold text-primary">
      <Clock aria-hidden className="size-3.5" />
      <bdi className="tabular-nums">{time}</bdi>
    </span>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((b) => (
        <li key={b} className="flex gap-3 text-[15px] leading-relaxed">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <Check aria-hidden className="size-3.5" />
          </span>
          {b}
        </li>
      ))}
    </ul>
  );
}

function Row({
  id,
  time,
  title,
  body,
  bullets,
  visual,
  flip,
}: {
  id: string;
  time: string;
  title: string;
  body: string;
  bullets: string[];
  /** Product visual from the showcase shop; the row is text-only when there's no data. */
  visual: React.ReactNode | null;
  flip?: boolean;
}) {
  return (
    <article aria-labelledby={id} className={cn("grid grid-cols-1 items-center gap-10 lg:gap-16", visual && "lg:grid-cols-2")}>
      <div className={cn("max-w-xl", flip && "lg:order-2")}>
        <TimeChip time={time} />
        <h3 id={id} className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{body}</p>
        <Bullets items={bullets} />
      </div>
      {visual && (
        <div aria-hidden className="rounded-2xl border bg-muted/50 p-4 sm:p-8">
          {visual}
        </div>
      )}
    </article>
  );
}

const PIPELINE: TicketStatus[] = ["RECEIVED", "DIAGNOSING", "WAITING_PART", "REPAIRING", "READY"];

type Showcase = ShowcaseData;

function TicketsVisual({ showcase }: { showcase: Showcase & { featured: NonNullable<Showcase["featured"]> } }) {
  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap items-center justify-center gap-1.5">
        {PIPELINE.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusBadge status={s} />
            {i < PIPELINE.length - 1 && <ChevronRight className="size-3.5 text-subtle-foreground rtl:rotate-180" />}
          </li>
        ))}
      </ol>
      <TicketCardMock card={showcase.featured} shop={showcase.shop} className="mx-auto max-w-md" />
    </div>
  );
}

function WhatsAppVisual({ customer, message, countryCode }: { customer: { name: string; phone: string }; message: string; countryCode: string }) {
  const name = customer.name;
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border bg-card shadow-pop">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">{name.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            <Ltr>{formatPhone(customer.phone, countryCode)}</Ltr>
          </p>
        </div>
      </div>
      <div className="bg-wa-wallpaper p-4">
        <div className="relative ms-auto w-fit max-w-[88%] rounded-lg rounded-se-none bg-wa-bubble px-3 pt-2 pb-5 text-sm leading-relaxed whitespace-pre-line text-wa-text shadow-card">
          {message}
          <span className="absolute end-2 bottom-1 flex items-center text-wa-meta">
            <CheckCheck className="size-3.5 text-wa-tick" />
          </span>
        </div>
      </div>
    </div>
  );
}

function CurrencyVisual({ shop, totalUsdCents, balanceUsdCents }: { shop: Showcase["shop"]; totalUsdCents: number | null; balanceUsdCents: number | null }) {
  const t = useTranslations("marketing");
  const format = useFormatter();
  const money = { rate: shop.exchangeRate, rounding: shop.lbpRounding };
  return (
    <div className="mx-auto max-w-sm rounded-xl border bg-card p-5 shadow-pop">
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="text-muted-foreground">{t("features.currency.rate")}</span>
        <Ltr className="font-semibold tabular-nums">{t("features.currency.rateValue", { rate: format.number(shop.exchangeRate) })}</Ltr>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        {totalUsdCents !== null && (
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{t("mock.total")}</dt>
            <dd>
              <Money usdCents={totalUsdCents} {...money} className="items-end text-lg rtl:items-start" />
            </dd>
          </div>
        )}
        {balanceUsdCents !== null && (
          <div className="flex items-start justify-between gap-3 border-t pt-3">
            <dt className="font-medium">{t("mock.balance")}</dt>
            <dd>
              <Money usdCents={balanceUsdCents} {...money} className="items-end text-lg rtl:items-start" usdClassName="text-primary" />
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function GridCard({ icon: Icon, time, title, body }: { icon: LucideIcon; time: string; title: string; body: string }) {
  return (
    <li className="flex flex-col rounded-xl border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        <TimeChip time={time} />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

const GRID = [
  { key: "pos", icon: ScanBarcode },
  { key: "inventory", icon: Boxes },
  { key: "cash", icon: Vault },
  { key: "track", icon: QrCode },
  { key: "language", icon: Languages },
  { key: "staff", icon: UsersRound },
] as const;

export function DayFeatures({ showcase }: { showcase: Showcase | null }) {
  const t = useTranslations("marketing");
  const featured = showcase?.featured ?? null;
  const total = showcase?.sale?.totalUsdCents ?? featured?.totalUsdCents ?? null;
  const f = (k: string) => t(`features.${k}` as "features.tickets.title");
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 py-16 sm:py-24">
      <Container>
        <SectionHeading
          id="features-title"
          eyebrow={t("day.eyebrow")}
          title={t("day.title")}
          subtitle={t("day.subtitle")}
        />
        <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
          <Row
            id="f-tickets"
            time={f("tickets.time")}
            title={f("tickets.title")}
            body={f("tickets.body")}
            bullets={[f("tickets.b1"), f("tickets.b2"), f("tickets.b3")]}
            visual={showcase && featured ? <TicketsVisual showcase={{ ...showcase, featured }} /> : null}
          />
          <Row
            id="f-currency"
            flip
            time={f("currency.time")}
            title={f("currency.title")}
            body={f("currency.body")}
            bullets={[f("currency.b1"), f("currency.b2"), f("currency.b3")]}
            visual={
              showcase ? (
                <CurrencyVisual shop={showcase.shop} totalUsdCents={total} balanceUsdCents={featured ? featured.balanceUsdCents : null} />
              ) : null
            }
          />
          <Row
            id="f-whatsapp"
            time={f("whatsapp.time")}
            title={f("whatsapp.title")}
            body={f("whatsapp.body")}
            bullets={[f("whatsapp.b1"), f("whatsapp.b2")]}
            visual={
              showcase && featured && showcase.readyMessage ? (
                <WhatsAppVisual customer={featured.customer} message={showcase.readyMessage} countryCode={showcase.shop.countryCode} />
              ) : null
            }
          />
        </div>
        <ul className="mt-20 grid grid-cols-1 gap-4 sm:mt-28 sm:grid-cols-2 lg:grid-cols-3">
          {GRID.map(({ key, icon }) => (
            <GridCard
              key={key}
              icon={icon}
              time={f(`${key}.time`)}
              title={f(`${key}.title`)}
              body={f(`${key}.body`)}
            />
          ))}
        </ul>
      </Container>
    </section>
  );
}
