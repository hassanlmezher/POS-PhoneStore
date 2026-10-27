"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { MoneyInput } from "@/components/money-input";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { adjustPrices, savePrice } from "@/features/prices/actions";
import type { PriceRow } from "@/features/prices/queries";
import { adjustPrice, ROUND_STEPS } from "@/features/prices/rules";
import { DevicePicker, type CatalogBrand, type DeviceValue } from "@/features/tickets/ui/device-picker";
import { formatMoney } from "@/lib/money";

type Common = { open: boolean; onOpenChange: (open: boolean) => void };

/** Add or edit one price. No phone picked = the price for any model. */
export function PriceDialog({
  open,
  onOpenChange,
  price,
  catalog,
  services,
  rate,
  rounding,
}: Common & { price?: PriceRow; catalog: CatalogBrand[]; services: string[]; rate: number; rounding: number }) {
  const t = useTranslations("prices");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const listId = useId();
  const [pending, startTransition] = useTransition();
  const [device, setDevice] = useState<DeviceValue>(price?.modelId ? { kind: "model", id: price.modelId, label: price.device ?? "" } : null);
  const [service, setService] = useState(price?.service ?? "");
  const [amount, setAmount] = useState(price ? (price.usdCents / 100).toFixed(2) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!service.trim()) local.service = "required";
    if (!amount.trim()) local.price = "required";
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const res = await savePrice({ deviceModelId: device?.kind === "model" ? device.id : "", service, price: amount }, price?.id);
      if (!res.ok) {
        if (res.fieldErrors) return setErrors(res.fieldErrors);
        return void toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
      }
      toast.success(price ? t("updated") : t("added"));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{price ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogHint")}</DialogDescription>
        </DialogHeader>
        <form id="price-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <DevicePicker idPrefix="price" allowOther={false} label={t("phoneModel")} catalog={catalog} value={device} onChange={setDevice} error={errors.deviceModelId} />
            {!device && <p className="text-xs text-muted-foreground">{t("anyModelHint")}</p>}
          </div>
          <Field label={t("service")} htmlFor="price-service" error={errors.service}>
            <Input
              {...fieldAria("price-service", errors.service)}
              list={listId}
              autoComplete="off"
              maxLength={60}
              placeholder={t("servicePlaceholder")}
              value={service}
              onChange={(e) => setService(e.target.value)}
            />
            <datalist id={listId}>
              {services.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label={t("price")} htmlFor="price-amount" error={errors.price}>
            <MoneyInput {...fieldAria("price-amount", errors.price)} value={amount} onValueChange={setAmount} rate={rate} rounding={rounding} placeholder="0.00" />
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form="price-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {price ? tc("save") : t("addButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const QUICK_PERCENTS = [5, 10, 20, -5, -10];

/** "Change all prices": +/- a percentage (for every price or one service), rounded, with a preview. */
export function AdjustDialog({ open, onOpenChange, prices, services }: Common & { prices: PriceRow[]; services: string[] }) {
  const t = useTranslations("prices");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [percentText, setPercentText] = useState("10");
  const [step, setStep] = useState<string>("100");
  const [service, setService] = useState("");

  const percent = /^[+-]?\d{1,3}$/.test(percentText.trim()) ? Number(percentText.trim()) : null;
  const valid = percent !== null && percent !== 0 && percent >= -90 && percent <= 500;
  const affected = useMemo(
    () => prices.filter((p) => !service || p.service.toLowerCase() === service.toLowerCase()),
    [prices, service],
  );
  const examples = valid ? affected.slice(0, 3).map((p) => ({ p, next: adjustPrice(p.usdCents, percent, Number(step)) })) : [];

  function apply() {
    if (!valid) return;
    startTransition(async () => {
      const res = await adjustPrices({ percent, step: Number(step), service });
      if (!res.ok) return void toast.error(te.has(res.error) ? te(res.error as never) : te("generic"));
      toast.success(t("adjusted", { count: res.count ?? 0 }));
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("adjustTitle")}</DialogTitle>
          <DialogDescription>{t("adjustHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label={t("percent")} htmlFor="adjust-percent" error={percentText.trim() && !valid ? "invalid" : undefined}>
            <div className="relative">
              <Input
                {...fieldAria("adjust-percent", percentText.trim() && !valid ? "invalid" : undefined)}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
                className="pe-8 text-start tabular-nums"
                value={percentText}
                onChange={(e) => setPercentText(e.target.value)}
              />
              <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </Field>
          <div className="-mt-2 flex flex-wrap gap-2" role="group" aria-label={t("percent")}>
            {QUICK_PERCENTS.map((n) => (
              <Button key={n} type="button" variant="outline" size="sm" className="h-11 rounded-full sm:h-9" onClick={() => setPercentText(n > 0 ? `+${n}` : String(n))}>
                <span dir="ltr">{n > 0 ? `+${n}%` : `${n}%`}</span>
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("roundTo")}</span>
            <Segmented
              label={t("roundTo")}
              value={step}
              onValueChange={setStep}
              options={ROUND_STEPS.map((s) => ({ value: String(s), label: s === 0 ? t("noRounding") : formatMoney(s, "USD").replace(".00", "") }))}
            />
          </div>
          <Field label={t("which")} htmlFor="adjust-service">
            <NativeSelect id="adjust-service" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">{t("allServices")}</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className="font-medium">{t("willChange", { count: affected.length })}</p>
            {examples.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                {examples.map(({ p, next }) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-2">
                    <span dir="auto" className="min-w-0 truncate">
                      {[p.device, p.service].filter(Boolean).join(" · ")}
                    </span>
                    <span dir="ltr" className="ms-auto flex items-center gap-1 tabular-nums">
                      {formatMoney(p.usdCents, "USD")}
                      <ArrowRight aria-hidden className="size-3.5" />
                      <span className="font-medium text-foreground">{formatMoney(next, "USD")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={apply} disabled={pending || !valid || affected.length === 0}>
            {pending && <Loader2 className="animate-spin" />}
            {t("applyChange")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
