import { useFormatter, useTranslations } from "next-intl";
import { CalendarClock, CheckCheck, Lock, MessageCircle, Package, ScanBarcode } from "lucide-react";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { Ltr } from "@/components/ltr";
import type { ShowcaseData } from "@/features/marketing/showcase";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

/**
 * Landing-page product preview built from real UI pieces and live data from the showcase (demo)
 * shop. Every piece hides itself when its data is missing; nothing is invented.
 */
export type ShowcaseShop = ShowcaseData["shop"];
export type ShowcaseCard = ShowcaseData["ready"][number];

/** Static 3×3 pattern-lock icon (the real pattern is never shown), drawn like the app's PatternGrid. */
function PatternThumb({ className }: { className?: string }) {
  const pts = [
    [6, 6], [18, 6], [30, 6],
    [6, 18], [18, 18], [30, 18],
    [6, 30], [18, 30], [30, 30],
  ];
  const path = [1, 5, 9, 6].map((n) => pts[n - 1]);
  return (
    <svg viewBox="0 0 36 36" aria-hidden className={cn("size-9 text-primary", className)}>
      <polyline
        points={path.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" className={[1, 5, 9, 6].includes(i + 1) ? "fill-primary" : "fill-border"} />
      ))}
    </svg>
  );
}

export function TicketCardMock({ card, shop, className }: { card: ShowcaseCard; shop: ShowcaseShop; className?: string }) {
  const t = useTranslations("marketing.mock");
  const format = useFormatter();
  const money = { rate: shop.exchangeRate, rounding: shop.lbpRounding };
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-pop sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{t("ticket")}</p>
          <p className="mt-0.5 text-lg font-semibold">
            <Ltr>{card.label}</Ltr>
          </p>
        </div>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-3 truncate font-medium">{card.device}</p>
      <p className="truncate text-sm text-muted-foreground">
        {card.customer.name} · <Ltr>{formatPhone(card.customer.phone, shop.countryCode)}</Ltr>
      </p>
      <ul className="mt-4 divide-y rounded-lg border text-sm">
        {card.hasPattern && (
          <li className="flex min-h-12 items-center gap-3 px-3 py-2">
            <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{t("passcode")}</span>
            <PatternThumb />
          </li>
        )}
        {card.items.slice(0, 2).map((item, i) => (
          <li key={i} className="flex min-h-12 items-center gap-3 px-3 py-2">
            <Package aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{item.description}</span>
            <Money usdCents={item.unitPriceUsdCents * item.qty} {...money} layout="inline" className="text-sm" />
          </li>
        ))}
        {card.promisedAt && (
          <li className="flex min-h-12 items-center gap-3 px-3 py-2">
            <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">
              {t("due", {
                date: format.dateTime(card.promisedAt, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: shop.timezone }),
              })}
            </span>
          </li>
        )}
      </ul>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t("balance")}</p>
          <Money usdCents={card.balanceUsdCents} {...money} className="text-lg" />
        </div>
        <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-success-soft px-3 text-sm font-medium text-success">
          <MessageCircle aria-hidden className="size-4" />
          {t("whatsapp")}
        </span>
      </div>
    </div>
  );
}

function MiniCard({ card, shop }: { card: ShowcaseCard; shop: ShowcaseShop }) {
  return (
    <li className="rounded-lg border bg-card p-3 shadow-card">
      <p className="text-sm font-semibold">
        <Ltr>{card.label}</Ltr>
      </p>
      <p className="mt-1 truncate text-sm font-medium">{card.device}</p>
      <p className="truncate text-xs text-muted-foreground">{card.customer.name}</p>
      <Money usdCents={card.balanceUsdCents} rate={shop.exchangeRate} rounding={shop.lbpRounding} layout="inline" className="mt-2 text-xs" />
    </li>
  );
}

export function KanbanColumnMock({ cards, shop, className }: { cards: ShowcaseCard[]; shop: ShowcaseShop; className?: string }) {
  const t = useTranslations("marketing.mock");
  const shown = cards.slice(0, 2);
  return (
    <div className={cn("flex flex-col rounded-xl border bg-muted/60 shadow-card", className)}>
      <div className="flex h-12 items-center gap-2 px-3">
        <span aria-hidden className="size-2 rounded-full bg-status-ready-foreground" />
        <span className="text-sm font-semibold">{t("column")}</span>
        <span className="ms-auto rounded-md bg-card px-1.5 text-xs font-medium text-muted-foreground tabular-nums shadow-card">
          {cards.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2 px-2 pb-2">
        {shown.map((c) => (
          <MiniCard key={c.label} card={c} shop={shop} />
        ))}
      </ul>
    </div>
  );
}

export function PosTotalMock({ sale, shop, className }: { sale: NonNullable<ShowcaseData["sale"]>; shop: ShowcaseShop; className?: string }) {
  const t = useTranslations("marketing.mock");
  const tm = useTranslations("paymentMethods");
  const money = { rate: shop.exchangeRate, rounding: shop.lbpRounding };
  const count = sale.items.reduce((n, i) => n + i.qty, 0);
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center gap-2">
        <ScanBarcode aria-hidden className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">
          {t("sale")} <Ltr>#{sale.number}</Ltr>
        </span>
        <span className="ms-auto text-xs text-muted-foreground">{t("items", { count })}</span>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {sale.items.slice(0, 3).map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-2">
            <span className="truncate">{item.description}</span>
            <Money
              usdCents={item.unitPriceUsdCents * item.qty - item.discountUsdCents}
              {...money}
              className="items-end text-sm rtl:items-start"
              usdClassName="font-medium"
            />
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t pt-3">
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="text-sm text-muted-foreground">{t("total")}</span>
          <Money usdCents={sale.totalUsdCents} {...money} className="items-end text-xl rtl:items-start" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary">{tm("CASH")}</span>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{tm("WHISH")}</span>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{tm("OMT")}</span>
        </div>
      </div>
    </div>
  );
}

/** Toast-like confirmation chip, same look as the app's Sonner toasts. */
export function NotifiedChip({ className }: { className?: string }) {
  const t = useTranslations("marketing.mock");
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-pop", className)}>
      <span className="flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCheck aria-hidden className="size-3.5" />
      </span>
      {t("notified")}
    </div>
  );
}

/** Whether the showcase has enough data to draw the hero preview. */
export function hasProductMock(showcase: ShowcaseData | null): showcase is ShowcaseData {
  return !!showcase && !!(showcase.featured || showcase.ready.length || showcase.sale);
}

/** Hero visual: real UI pieces composed into a product preview of the showcase shop. */
export function ProductMock({ showcase }: { showcase: ShowcaseData }) {
  const t = useTranslations("marketing.mock");
  const { shop, featured, ready, sale } = showcase;
  const bottom = [ready.length > 0, !!sale].filter(Boolean).length;
  return (
    <div role="img" aria-label={t("label")} className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[1.75rem] bg-primary-soft/70 sm:-inset-6" />
      <div className={cn("grid gap-3 sm:gap-4", bottom === 2 && "sm:grid-cols-2")}>
        {featured && <TicketCardMock card={featured} shop={shop} className={cn(bottom === 2 && "sm:col-span-2")} />}
        {ready.length > 0 && <KanbanColumnMock cards={ready} shop={shop} className={cn("hidden sm:flex", !featured && !sale && "flex")} />}
        {sale && <PosTotalMock sale={sale} shop={shop} />}
      </div>
      {featured && <NotifiedChip className="absolute -top-7 end-3 sm:-top-8 sm:end-6" />}
    </div>
  );
}
