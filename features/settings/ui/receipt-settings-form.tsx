"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { Ltr } from "@/components/ltr";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { updateReceiptSettings } from "@/features/settings/actions";
import { formatMoney, toLbp } from "@/lib/money";

const ROUNDINGS = [1, 100, 500, 1000, 5000, 10000] as const;
const PREFIX_RE = /^[A-Za-z]{0,5}-?$/;

type Values = {
  ticketPrefix: string;
  defaultWarrantyDays: number;
  storageFreeDays: number;
  storageFeeUsdCents: number;
  lbpRounding: number;
  receiptFooter: string;
  receiptFooterAr: string;
  termsText: string;
  termsTextAr: string;
};

type Props = {
  shop: Values;
  /** Current exchange rate, for the rounding example. */
  rate: number;
  nextTicketNumber: number;
  latestTicket: { number: number; label: string } | null;
  readOnly: boolean;
};

export function ReceiptSettingsForm({ shop, rate, nextTicketNumber, latestTicket, readOnly }: Props) {
  const t = useTranslations("settings.receipts");
  const ts = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    ...shop,
    defaultWarrantyDays: String(shop.defaultWarrantyDays),
    lbpRounding: String(shop.lbpRounding),
    storageFreeDays: String(shop.storageFreeDays),
    storageFeeUsdCents: shop.storageFeeUsdCents > 0 ? (shop.storageFeeUsdCents / 100).toFixed(2) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const prefixOk = PREFIX_RE.test(v.ticketPrefix.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prefixOk) return setErrors({ ticketPrefix: "invalidPrefix" });
    startTransition(async () => {
      const res = await updateReceiptSettings(v);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(ts("saveFailed"));
        return;
      }
      setErrors({});
      toast.success(ts("saved"));
      router.refresh();
    });
  }

  const sampleRounding = Number(v.lbpRounding);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <fieldset disabled={readOnly} className="contents">
        <SectionCard title={t("repairsTitle")} description={t("repairsDescription")}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field
              label={t("prefix")}
              htmlFor="rc-prefix"
              error={errors.ticketPrefix ?? (prefixOk ? null : "invalidPrefix")}
              hint={
                <>
                  {t("prefixExample")} <Ltr className="font-medium text-foreground">{`${v.ticketPrefix.trim()}${nextTicketNumber}`}</Ltr>
                </>
              }
            >
              <Input
                {...fieldAria("rc-prefix", errors.ticketPrefix ?? (prefixOk ? null : "invalidPrefix"))}
                autoFocus
                dir="ltr"
                className="text-start font-mono uppercase"
                maxLength={6}
                value={v.ticketPrefix}
                onChange={(e) => setV((p) => ({ ...p, ticketPrefix: e.target.value.toUpperCase() }))}
              />
            </Field>
            <Field label={t("warrantyDays")} htmlFor="rc-warranty" hint={t("warrantyHint")} error={errors.defaultWarrantyDays}>
              <Input
                {...fieldAria("rc-warranty", errors.defaultWarrantyDays)}
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                dir="ltr"
                className="text-start tabular-nums"
                value={v.defaultWarrantyDays}
                onChange={set("defaultWarrantyDays")}
              />
            </Field>
            <Field
              label={t("rounding")}
              htmlFor="rc-rounding"
              error={errors.lbpRounding}
              hint={
                <>
                  {t("roundingExample")} <Ltr>{formatMoney(toLbp(1234, rate, sampleRounding), "LBP")}</Ltr>
                </>
              }
            >
              <NativeSelect {...fieldAria("rc-rounding", errors.lbpRounding)} value={v.lbpRounding} onChange={set("lbpRounding")}>
                {ROUNDINGS.map((r) => (
                  <option key={r} value={r}>
                    {r === 1 ? t("noRounding") : t("roundTo", { amount: formatMoney(r, "LBP") })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </SectionCard>

        <SectionCard id="storage" title={t("storageTitle")} description={t("storageDescription")}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("storageFreeDays")} htmlFor="rc-free-days" hint={t("storageFreeDaysHint")} error={errors.storageFreeDays}>
              <Input
                {...fieldAria("rc-free-days", errors.storageFreeDays)}
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                dir="ltr"
                className="text-start tabular-nums"
                value={v.storageFreeDays}
                onChange={set("storageFreeDays")}
              />
            </Field>
            <Field label={t("storageFee")} htmlFor="rc-storage-fee" hint={t("storageFeeHint")} error={errors.storageFeeUsdCents} optional>
              <MoneyInput
                {...fieldAria("rc-storage-fee", errors.storageFeeUsdCents)}
                value={v.storageFeeUsdCents}
                onValueChange={(val) => setV((p) => ({ ...p, storageFeeUsdCents: val }))}
                rate={rate}
                rounding={sampleRounding}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title={t("receiptTitle")}
          description={t("receiptDescription")}
          actions={
            latestTicket && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/print/ticket/${latestTicket.number}?preview=1`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="rtl:-scale-x-100" />
                  {t("previewReceipt", { ticket: latestTicket.label })}
                </a>
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-6">
            <Pair
              label={t("footer")}
              hint={t("footerHint")}
              en={{ id: "rc-footer", value: v.receiptFooter, onChange: set("receiptFooter"), error: errors.receiptFooter, rows: 2, max: 300 }}
              ar={{ id: "rc-footer-ar", value: v.receiptFooterAr, onChange: set("receiptFooterAr"), error: errors.receiptFooterAr, rows: 2, max: 300 }}
            />
            <Pair
              label={t("terms")}
              hint={t("termsHint")}
              en={{ id: "rc-terms", value: v.termsText, onChange: set("termsText"), error: errors.termsText, rows: 6, max: 2000 }}
              ar={{ id: "rc-terms-ar", value: v.termsTextAr, onChange: set("termsTextAr"), error: errors.termsTextAr, rows: 6, max: 2000 }}
            />
          </div>
        </SectionCard>

        {/* Phones: a full-width bar above the bottom nav (same as the intake form); larger screens: a floating button. */}
        <div className="sticky bottom-20 z-10 flex justify-end rounded-xl border bg-card/95 p-3 shadow-pop backdrop-blur md:bottom-4 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
          <Button type="submit" disabled={pending || readOnly} className="w-full md:w-auto md:shadow-pop">
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

type Side = {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  rows: number;
  max: number;
};

/** English and Arabic versions of the same text, side by side (stacked on phones). */
function Pair({ label, hint, en, ar }: { label: string; hint: string; en: Side; ar: Side }) {
  const tc = useTranslations("common");
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm font-medium">
        {label}
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
      </legend>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            [en, "en", "ltr", tc("english")],
            [ar, "ar", "rtl", tc("arabic")],
          ] as const
        ).map(([s, lang, dir, name]) => (
          <Field key={s.id} label={name} htmlFor={s.id} optional error={s.error}>
            <Textarea {...fieldAria(s.id, s.error)} lang={lang} dir={dir} rows={s.rows} maxLength={s.max} value={s.value} onChange={s.onChange} />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}
