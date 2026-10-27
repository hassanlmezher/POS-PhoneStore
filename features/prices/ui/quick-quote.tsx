"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, MessageCircle, Plus, Wrench } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Field } from "@/components/field";
import { Money } from "@/components/money";
import { Segmented } from "@/components/segmented";
import { useShopCountryCode } from "@/components/shop-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quoteMessage, type QuoteTexts } from "@/features/prices/message";
import type { PriceRow } from "@/features/prices/queries";
import { DevicePicker, type CatalogBrand, type DeviceValue } from "@/features/tickets/ui/device-picker";
import { formatMoney } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { waLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type Props = {
  /** Only models that have a price. */
  catalog: CatalogBrand[];
  prices: PriceRow[];
  shopName: string;
  rate: number;
  rounding: number;
  defaultLocale: "EN" | "AR";
  texts: Record<"EN" | "AR", QuoteTexts>;
  canCreateTicket: boolean;
};

/** Pick a phone + repairs → price in $ and LBP → send it on WhatsApp (wa.me) or start the ticket. */
export function QuickQuote({ catalog, prices, shopName, rate, rounding, defaultLocale, texts, canCreateTicket }: Props) {
  const t = useTranslations("prices");
  const countryCode = useShopCountryCode();
  const [device, setDevice] = useState<DeviceValue>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [lang, setLang] = useState<"EN" | "AR">(defaultLocale);
  const [phone, setPhone] = useState("");

  const modelId = device?.kind === "model" ? device.id : null;
  // This phone's own prices first, then the "any model" ones.
  const options = useMemo(
    () => prices.filter((p) => p.modelId === null || (modelId !== null && p.modelId === modelId)).sort((a, b) => Number(a.modelId === null) - Number(b.modelId === null)),
    [prices, modelId],
  );
  const items = options.filter((p) => picked.includes(p.id));
  const total = items.reduce((s, i) => s + i.usdCents, 0);
  const message = quoteMessage(texts[lang], {
    shop: shopName,
    device: device?.kind === "model" ? device.label : null,
    items: items.map((i) => ({ service: i.service, usdCents: i.usdCents })),
    rate,
    rounding,
  });
  const e164 = phone.trim() ? normalizePhone(phone, countryCode) : null;
  const href = e164 ? waLink(e164, message) : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const ticketHref = `/tickets/new?${new URLSearchParams({ ...(modelId && { model: modelId }), quote: items.map((i) => i.id).join(",") }).toString()}`;

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <section aria-labelledby="quote-title" className="overflow-hidden rounded-xl border bg-card shadow-card">
      <header className="border-b px-4 py-3 sm:px-6">
        <h2 id="quote-title" className="font-semibold">
          {t("quoteTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("quoteHint")}</p>
      </header>
      <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <DevicePicker
            idPrefix="quote"
            allowOther={false}
            label={t("phoneModel")}
            catalog={catalog}
            value={device}
            onChange={(v) => {
              setDevice(v);
              setPicked((cur) => cur.filter((id) => prices.find((p) => p.id === id)?.modelId === null));
            }}
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("repairs")}</span>
            {options.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{modelId ? t("noPricesForModel") : t("pickModelFirst")}</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("repairs")}>
                {options.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                        on ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-accent",
                      )}
                    >
                      {on ? <Check aria-hidden className="size-4 text-primary" /> : <Plus aria-hidden className="size-4 text-muted-foreground" />}
                      <span dir="auto">{p.service}</span>
                      <span dir="ltr" className="text-muted-foreground tabular-nums">
                        {formatMoney(p.usdCents, "USD")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4 rounded-lg bg-muted/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">{t("quoteTotal")}</span>
            <Money usdCents={total} rate={rate} rounding={rounding} className="items-end text-xl font-semibold rtl:items-start" lbpClassName="text-sm font-normal text-muted-foreground" />
          </div>
          {items.length > 0 && (
            <>
              <div className="rounded-lg bg-wa-wallpaper p-3">
                <p
                  dir={lang === "AR" ? "rtl" : "ltr"}
                  className="w-fit max-w-full rounded-lg bg-wa-bubble px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-wa-text shadow-card [overflow-wrap:anywhere]"
                >
                  {message}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto]">
                <Field label={t("customerPhone")} htmlFor="quote-phone" optional>
                  <Input id="quote-phone" type="tel" dir="ltr" inputMode="tel" autoComplete="off" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("messageLanguage")}</span>
                  <Segmented
                    label={t("messageLanguage")}
                    value={lang}
                    onValueChange={setLang}
                    options={[
                      { value: "EN", label: "English" },
                      { value: "AR", label: "العربية" },
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="flex-1 bg-success text-success-foreground hover:bg-success/90">
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle />
                    {t("sendWhatsApp")}
                  </a>
                </Button>
                <CopyButton value={message} label={t("copyMessage")} />
                {canCreateTicket && (
                  <Button variant="outline" asChild>
                    <Link href={ticketHref}>
                      <Wrench />
                      {t("startTicket")}
                    </Link>
                  </Button>
                )}
              </div>
              {phone.trim() && !e164 && <p className="text-xs text-warning">{t("phoneInvalid")}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
