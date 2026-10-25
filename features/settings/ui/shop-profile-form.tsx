"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Field, fieldAria } from "@/components/field";
import { SectionCard } from "@/components/section-card";
import { SearchSelect, type SearchSelectOption } from "@/components/search-select";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateShopProfile } from "@/features/settings/actions";
import { LogoUpload } from "./logo-upload";

type Props = {
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    defaultLocale: "EN" | "AR";
    logoUrl: string | null;
    timezone: string;
    countryCode: string;
  };
  readOnly: boolean;
};

/** Zones shops in our markets use, listed first. */
const SUGGESTED_ZONES = [
  "Asia/Beirut",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Bahrain",
  "Asia/Muscat",
  "Asia/Amman",
  "Africa/Cairo",
  "Asia/Baghdad",
];

/** ISO region → calling code, shown as quick picks under the country code field. */
const SUGGESTED_CODES: [region: string, code: string][] = [
  ["LB", "961"],
  ["AE", "971"],
  ["SA", "966"],
  ["QA", "974"],
  ["KW", "965"],
  ["BH", "973"],
  ["OM", "968"],
  ["JO", "962"],
  ["EG", "20"],
  ["IQ", "964"],
];

function displayRegion(locale: string, region: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

function zoneOption(zone: string, now: Date): SearchSelectOption {
  let hint: string | undefined;
  try {
    hint = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value;
  } catch {}
  return { value: zone, label: zone.replaceAll("_", " "), hint };
}

function useZoneGroups(current: string, suggestedLabel: string, allLabel: string) {
  return useMemo(() => {
    const now = new Date();
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : SUGGESTED_ZONES;
    const known = new Set(all);
    const suggested = SUGGESTED_ZONES.filter((z) => known.has(z) || z === current);
    const rest = all.filter((z) => !SUGGESTED_ZONES.includes(z));
    // Keep a stored zone that this browser doesn't list (aliases like "Asia/Calcutta") selectable.
    if (current && !known.has(current) && !SUGGESTED_ZONES.includes(current)) rest.unshift(current);
    return [
      { label: suggestedLabel, options: suggested.map((z) => zoneOption(z, now)) },
      { label: allLabel, options: rest.map((z) => zoneOption(z, now)) },
    ];
  }, [current, suggestedLabel, allLabel]);
}

export function ShopProfileForm({ shop, readOnly }: Props) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address ?? "");
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [locale, setLocale] = useState(shop.defaultLocale);
  const [timezone, setTimezone] = useState(shop.timezone);
  const [countryCode, setCountryCode] = useState(shop.countryCode);
  const uiLocale = useLocale();
  const zoneGroups = useZoneGroups(shop.timezone, t("shop.timezoneSuggested"), t("shop.timezoneAll"));
  const regionName = (r: string) => displayRegion(uiLocale, r);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: "required" });
    if (!/^[1-9]\d{0,3}$/.test(countryCode)) return setErrors({ countryCode: "invalidCountryCode" });
    startTransition(async () => {
      const res = await updateShopProfile({ name, address, phone, defaultLocale: locale, timezone, countryCode });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(t("saveFailed"));
        return;
      }
      setErrors({});
      toast.success(t("saved"));
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <SectionCard title={t("shop.title")} description={t("shop.description")}>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <fieldset disabled={readOnly} className="contents">
            <Field label={t("shop.name")} htmlFor="shop-name" error={errors.name}>
              <Input {...fieldAria("shop-name", errors.name)} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t("shop.phone")} htmlFor="shop-phone" optional hint={t("shop.phoneHint")} error={errors.phone}>
              <Input
                {...fieldAria("shop-phone", errors.phone)}
                type="tel"
                inputMode="tel"
                dir="ltr"
                className="text-start"
                placeholder={`+${countryCode || shop.countryCode}`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label={t("shop.address")} htmlFor="shop-address" optional error={errors.address}>
              <Input {...fieldAria("shop-address", errors.address)} value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label={t("shop.language")} htmlFor="shop-locale" hint={t("shop.languageHint")}>
              <Segmented
                id="shop-locale"
                label={t("shop.language")}
                value={locale}
                onValueChange={setLocale}
                options={[
                  { value: "EN", label: tc("english") },
                  { value: "AR", label: tc("arabic") },
                ]}
                className="w-full sm:w-64"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("shop.timezone")} htmlFor="shop-timezone" hint={t("shop.timezoneHint")} error={errors.timezone}>
                <SearchSelect
                  id="shop-timezone"
                  value={timezone}
                  onValueChange={setTimezone}
                  groups={zoneGroups}
                  searchPlaceholder={t("shop.timezoneSearch")}
                  emptyText={t("shop.timezoneEmpty")}
                  disabled={readOnly}
                  invalid={!!errors.timezone}
                  describedBy="shop-timezone-msg"
                />
              </Field>
              <Field label={t("shop.countryCode")} htmlFor="shop-country-code" hint={t("shop.countryCodeHint")} error={errors.countryCode}>
                <div className="relative" dir="ltr">
                  <span aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    +
                  </span>
                  <Input
                    {...fieldAria("shop-country-code", errors.countryCode)}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    className="ps-7 tabular-nums"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </Field>
            </div>
            <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("shop.countryCodePicks")}>
              {SUGGESTED_CODES.map(([region, code]) => (
                <button
                  key={region}
                  type="button"
                  title={regionName(region)}
                  aria-label={`${regionName(region)} +${code}`}
                  aria-pressed={countryCode === code}
                  onClick={() => setCountryCode(code)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                >
                  <span className="font-medium">{region}</span>
                  <span dir="ltr">+{code}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t pt-5">
              <Button type="submit" disabled={pending || readOnly}>
                {pending ? tc("saving") : tc("save")}
              </Button>
            </div>
          </fieldset>
        </form>
      </SectionCard>

      <LogoUpload logoUrl={shop.logoUrl} shopName={shop.name} readOnly={readOnly} />
    </div>
  );
}
